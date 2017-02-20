import { IConnection } from 'mysql';
import * as moment from 'moment';

export class LoginModel {
  adminLogin(connection: IConnection, username: string, password: string) {
    return new Promise((resolve, reject) => {
      let sql = `
      select id as employee_code, fullname from admin where username=? and password=?
      `;
      // run query
      connection.query(sql, [username, password], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }
  userLogin(connection: IConnection, username: string, password: string) {
    return new Promise((resolve, reject) => {
      let sql = `
      select employee_code, employee_name as fullname 
      from employees where employee_code=? and password=?
      `;
      // run query
      connection.query(sql, [username, password], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }
}