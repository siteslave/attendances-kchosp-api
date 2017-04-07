import { IConnection } from 'mysql';
import * as moment from 'moment';
import Knex = require('knex');

export class LoginModel {
  adminLogin(knex: Knex, username: string, password: string) {
    return knex('admin')
      .select('id as employee_code', 'fullname')
      .where({
        username: username,
        password: password
      });
  }

  userLogin(knex: Knex, username: string, password: string) {
    return knex('employees')
      .select('employee_code', knex.raw('concat(first_name, " ", last_name) as fullname'))
      .where({
        employee_code: username,
        password: password
      });
  }
}