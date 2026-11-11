-- 포인트 상점: 상품, 불변 가격 버전, 주문, 보유 수량
-- 앱 삽입 순서: spend 원장 → 주문 → 재고 이벤트 (지갑 잠금 아래 한 트랜잭션)
BEGIN;

CREATE TABLE shop_items (
    id uuid PRIMARY KEY,
    code varchar(40) NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]*$'),
    name varchar(80) NOT NULL CHECK (length(btrim(name)) > 0),
    description text,
    item_kind varchar(12) NOT NULL CHECK (item_kind IN ('consumable', 'permanent')),
    display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, item_kind)
);

CREATE INDEX shop_items_visible_idx ON shop_items (is_active, display_order, id);

CREATE TABLE shop_item_price_versions (
    id uuid PRIMARY KEY,
    item_id uuid NOT NULL REFERENCES shop_items(id) ON DELETE RESTRICT,
    version_no integer NOT NULL CHECK (version_no > 0),
    price_points integer NOT NULL CHECK (price_points > 0),
    effective_at timestamptz NOT NULL,
    created_by_admin_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (item_id, version_no),
    UNIQUE (id, item_id)
);

CREATE INDEX shop_price_versions_effective_idx
    ON shop_item_price_versions (item_id, effective_at DESC);

CREATE FUNCTION protect_shop_price_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'published shop prices are immutable' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER shop_price_versions_no_change
BEFORE UPDATE OR DELETE ON shop_item_price_versions
FOR EACH ROW EXECUTE FUNCTION protect_shop_price_version();

CREATE TABLE shop_orders (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES shop_items(id) ON DELETE RESTRICT,
    price_version_id uuid NOT NULL,
    quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
    unit_points integer NOT NULL CHECK (unit_points > 0),
    total_points bigint GENERATED ALWAYS AS (unit_points::bigint * quantity) STORED,
    status varchar(12) NOT NULL DEFAULT 'completed'
        CHECK (status IN ('completed', 'cancelled')),
    spend_transaction_id uuid NOT NULL,
    refund_transaction_id uuid,
    cancel_reason text,
    idempotency_key text NOT NULL CHECK (length(btrim(idempotency_key)) > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    cancelled_at timestamptz,
    UNIQUE (user_id, idempotency_key),
    UNIQUE (id, user_id),
    UNIQUE (id, user_id, item_id),
    FOREIGN KEY (price_version_id, item_id)
        REFERENCES shop_item_price_versions(id, item_id) ON DELETE RESTRICT,
    FOREIGN KEY (spend_transaction_id, user_id)
        REFERENCES point_transactions(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (refund_transaction_id, user_id)
        REFERENCES point_transactions(id, user_id) ON DELETE CASCADE,
    CHECK ((status = 'completed' AND refund_transaction_id IS NULL
                AND cancelled_at IS NULL AND cancel_reason IS NULL)
        OR (status = 'cancelled' AND refund_transaction_id IS NOT NULL
                AND cancelled_at IS NOT NULL
                AND cancel_reason IS NOT NULL
                AND length(btrim(cancel_reason)) > 0)),
    CHECK (spend_transaction_id IS DISTINCT FROM refund_transaction_id)
);

CREATE INDEX shop_orders_user_recent_idx ON shop_orders (user_id, created_at DESC, id DESC);

CREATE FUNCTION guard_shop_order_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    item_active boolean;
    price integer;
    price_effective_at timestamptz;
    tx_kind varchar(32);
    tx_source_type varchar(32);
    tx_source_id uuid;
    tx_delta bigint;
    tx_cap_delta bigint;
BEGIN
    SELECT is_active INTO item_active FROM shop_items WHERE id = NEW.item_id;
    SELECT price_points, effective_at INTO price, price_effective_at
      FROM shop_item_price_versions
     WHERE id = NEW.price_version_id AND item_id = NEW.item_id;
    IF item_active IS DISTINCT FROM true OR
       price IS DISTINCT FROM NEW.unit_points OR
       price_effective_at > NEW.created_at THEN
        RAISE EXCEPTION 'order needs an active item and its effective price'
            USING ERRCODE = '23514';
    END IF;

    -- total_points는 생성 열이라 BEFORE 트리거에서 NULL, 단가 × 수량을 직접 계산
    SELECT kind, source_type, source_id, available_delta, cap_delta
      INTO tx_kind, tx_source_type, tx_source_id, tx_delta, tx_cap_delta
      FROM point_transactions
     WHERE id = NEW.spend_transaction_id AND user_id = NEW.user_id;
    IF tx_kind IS DISTINCT FROM 'spend' OR
       tx_source_type IS DISTINCT FROM 'shop_order' OR
       tx_source_id IS DISTINCT FROM NEW.id OR
       tx_delta IS DISTINCT FROM -(NEW.unit_points::bigint * NEW.quantity) OR
       tx_cap_delta <> 0 THEN
        RAISE EXCEPTION 'order must match its point spend transaction'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.status <> 'completed' THEN
        RAISE EXCEPTION 'new order must be completed' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER shop_orders_guard_before_insert
BEFORE INSERT ON shop_orders
FOR EACH ROW EXECUTE FUNCTION guard_shop_order_insert();

-- completed → cancelled만 허용하며, 일치하는 refund 거래가 있어야 한다
CREATE FUNCTION guard_shop_order_update() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    tx_kind varchar(32);
    tx_source_type varchar(32);
    tx_source_id uuid;
    tx_original uuid;
    tx_delta bigint;
    tx_cap_delta bigint;
BEGIN
    IF ROW(OLD.user_id, OLD.item_id, OLD.price_version_id, OLD.quantity,
           OLD.unit_points, OLD.spend_transaction_id, OLD.idempotency_key,
           OLD.created_at)
       IS DISTINCT FROM
       ROW(NEW.user_id, NEW.item_id, NEW.price_version_id, NEW.quantity,
           NEW.unit_points, NEW.spend_transaction_id, NEW.idempotency_key,
           NEW.created_at) THEN
        RAISE EXCEPTION 'order identity and amount are immutable'
            USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'cancelled' AND
       ROW(OLD.status, OLD.refund_transaction_id, OLD.cancelled_at, OLD.cancel_reason)
       IS DISTINCT FROM
       ROW(NEW.status, NEW.refund_transaction_id, NEW.cancelled_at, NEW.cancel_reason) THEN
        RAISE EXCEPTION 'cancelled order cannot change' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'completed' AND NEW.status = 'cancelled' THEN
        SELECT kind, source_type, source_id, original_transaction_id,
               available_delta, cap_delta
          INTO tx_kind, tx_source_type, tx_source_id, tx_original,
               tx_delta, tx_cap_delta
          FROM point_transactions
         WHERE id = NEW.refund_transaction_id AND user_id = NEW.user_id;
        IF tx_kind IS DISTINCT FROM 'refund' OR
           tx_source_type IS DISTINCT FROM 'shop_order' OR
           tx_source_id IS DISTINCT FROM NEW.id OR
           tx_original IS DISTINCT FROM NEW.spend_transaction_id OR
           tx_delta < 0 OR tx_delta > (NEW.unit_points::bigint * NEW.quantity) OR
           tx_cap_delta <> 0 THEN
            RAISE EXCEPTION 'refund must match the order and not count toward the cap'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER shop_orders_guard_before_update
BEFORE UPDATE ON shop_orders
FOR EACH ROW EXECUTE FUNCTION guard_shop_order_update();

CREATE TABLE user_inventory (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES shop_items(id) ON DELETE RESTRICT,
    quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, item_id)
);

CREATE TABLE user_inventory_events (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES shop_items(id) ON DELETE RESTRICT,
    kind varchar(12) NOT NULL CHECK (kind IN ('purchase', 'refund', 'use')),
    quantity_delta integer NOT NULL CHECK (quantity_delta <> 0),
    order_id uuid,
    idempotency_key text NOT NULL UNIQUE CHECK (length(btrim(idempotency_key)) > 0),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (order_id, user_id, item_id)
        REFERENCES shop_orders(id, user_id, item_id) ON DELETE CASCADE,
    CHECK ((kind = 'purchase' AND quantity_delta > 0 AND order_id IS NOT NULL)
        OR (kind = 'refund' AND quantity_delta < 0 AND order_id IS NOT NULL)
        OR (kind = 'use' AND quantity_delta < 0))
);

CREATE INDEX user_inventory_events_user_idx
    ON user_inventory_events (user_id, occurred_at DESC, id DESC);

-- quantity CHECK가 음수 재고를 거부한다
CREATE FUNCTION apply_inventory_event() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    -- UPDATE 먼저: INSERT ... ON CONFLICT는 충돌 판정 전에 원본 증감값으로 CHECK를 평가함
    UPDATE user_inventory
       SET quantity = quantity + NEW.quantity_delta, updated_at = NEW.occurred_at
     WHERE user_id = NEW.user_id AND item_id = NEW.item_id;
    IF NOT FOUND THEN
        IF NEW.quantity_delta < 0 THEN
            RAISE EXCEPTION 'inventory cannot go below zero'
                USING ERRCODE = '23514';
        END IF;
        INSERT INTO user_inventory (user_id, item_id, quantity, updated_at)
        VALUES (NEW.user_id, NEW.item_id, NEW.quantity_delta, NEW.occurred_at)
        ON CONFLICT (user_id, item_id) DO UPDATE
           SET quantity = user_inventory.quantity + EXCLUDED.quantity,
               updated_at = EXCLUDED.updated_at;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER user_inventory_events_apply_after_insert
AFTER INSERT ON user_inventory_events
FOR EACH ROW EXECUTE FUNCTION apply_inventory_event();

CREATE FUNCTION protect_inventory_event() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' AND NOT EXISTS (
        SELECT 1 FROM users WHERE id = OLD.user_id
    ) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'inventory events are append-only' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER user_inventory_events_no_change
BEFORE UPDATE OR DELETE ON user_inventory_events
FOR EACH ROW EXECUTE FUNCTION protect_inventory_event();

COMMIT;
