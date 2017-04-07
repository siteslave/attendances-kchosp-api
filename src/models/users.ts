import * as moment from 'moment';
import Knex = require('knex');

export class UserModel {
  getWorkAllow(knex: Knex) {
    return knex('work_time_allow')
      .select(knex.raw('concat(iyear, "-", imonth) as ym'), knex.raw('concat(iyear,imonth) as ym2'))
      .groupByRaw('iyear, imonth')
      .orderBy('ym2', 'DESC');
  }
  getWorkHistory(knex: Knex, employeeCode, start, end) {
    return knex('work_type_attendances')
      .where('employee_code', employeeCode)
      .whereBetween('work_date', [start, end]);
  }

  changePassword(knex: Knex, employeeCode, password) {
    return knex('employees')
      .update({ password: password })
      .where('employee_code', employeeCode);
  }

  saveWork(knex: Knex, data) {
    return knex('work_type_attendances')
      .insert(data);
  }

  removeOldWork(knex: Knex, employeeCode, start, end) {
    return knex('work_type_attendances')
      .whereBetween('work_date', [start, end])
      .where('employee_code', employeeCode)
      .del();
  }
}