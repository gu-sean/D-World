import { Controller, Dependencies, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

/** 카테고리·난이도는 관리자가 관리하는 목록, 사용자에게는 활성 값만 보여 줌 */
@Controller()
@Dependencies(DatabaseService)
export class ReferenceController {
  constructor(database) {
    this.database = database;
  }

  async list(table) {
    // table은 아래 두 고정 값만 전달
    const { rows } = await this.database.query(
      `SELECT id, code, name, display_order FROM ${table}
        WHERE is_active ORDER BY display_order, name`,
    );
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      displayOrder: r.display_order,
    }));
  }

  @Get('categories')
  categories() {
    return this.list('goal_categories');
  }

  @Get('difficulty-levels')
  difficultyLevels() {
    return this.list('difficulty_levels');
  }
}
