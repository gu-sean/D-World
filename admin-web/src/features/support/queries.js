import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addTicketEvent, assignTicket, fetchTicket, fetchTickets, resolveTicket } from './api.js';

export const supportKeys = {
  all: ['support'],
  list: (params) => ['support', 'list', params],
  detail: (ticketId) => ['support', 'detail', ticketId],
};

/** M20 */
export const useTickets = (params) =>
  useQuery({
    queryKey: supportKeys.list(params),
    queryFn: () => fetchTickets(params),
    placeholderData: keepPreviousData,
  });

/** M21 */
export const useTicket = (ticketId) =>
  useQuery({ queryKey: supportKeys.detail(ticketId), queryFn: () => fetchTicket(ticketId) });

// Every change of this menu asks the menu's lists and details again (docs/parts/admin-web.md §7).
function useMenuMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supportKeys.all }),
  });
}

/** M22. Call with `{ticketId, body, idempotencyKey}`. */
export const useAssignTicket = () =>
  useMenuMutation(({ ticketId, body, idempotencyKey }) =>
    assignTicket(ticketId, body, idempotencyKey),
  );

/** M23. Call with `{ticketId, body, idempotencyKey}`. */
export const useAddTicketEvent = () =>
  useMenuMutation(({ ticketId, body, idempotencyKey }) =>
    addTicketEvent(ticketId, body, idempotencyKey),
  );

/** M24. Call with `{ticketId, body, idempotencyKey}`. */
export const useResolveTicket = () =>
  useMenuMutation(({ ticketId, body, idempotencyKey }) =>
    resolveTicket(ticketId, body, idempotencyKey),
  );
