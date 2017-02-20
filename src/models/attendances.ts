import { IConnection } from 'mysql';
import * as moment from 'moment';

export class AttendancesModel {
  saveAttendances(connection: IConnection, data: any) {
    return new Promise((resolve, reject) => {
      let sql = `
      insert into attendances(employee_code, checkin_date, checkin_time, imported_date)
      values ?
      `;
      // run query
      connection.query(sql, [data], (err, results) => {
        if (err) reject(err);
        else resolve(results);
        // release connection
        // connection.release();
      });
    });
  }

  saveImportedLog(connection: IConnection, imported_at, start, end, total) {
    return new Promise((resolve, reject) => {
      let sql = `
      insert into imported_logs(imported_at, start_date, end_date, total)
      values (?, ?, ?, ?)
      `;
      // run query
      connection.query(sql, [imported_at, start, end, total], (err, results) => {
        if (err) reject(err);
        else resolve();
        // release connection
        // connection.release();
      });
    });
  }

  removeAttendances(connection: IConnection, start, end) {
    return new Promise((resolve, reject) => {
      let sql = `delete from attendances where checkin_date between ? and ?`;
      // run query
      connection.query(sql, [start, end], (err, results) => {
        if (err) reject(err);
        else resolve(results);
        // release connection
        // connection.release();
      });
    });
  }

  getImportedLog(connection: IConnection) {
    return new Promise((resolve, reject) => {
      let sql = `select * from imported_logs order by imported_at desc limit 10`;
      // run query
      connection.query(sql, [], (err, results) => {
        if (err) reject(err);
        else resolve(results);
        // release connection
        // connection.release();
      });
    });
  }

  getProcessLog(connection: IConnection) {
    return new Promise((resolve, reject) => {
      let sql = `select * from processed_logs order by process_at desc limit 10`;
      // run query
      connection.query(sql, [], (err, results) => {
        if (err) reject(err);
        else resolve(results);
        // release connection
        // connection.release();
      });
    });
  }

  getInitialLog(connection: IConnection) {
    return new Promise((resolve, reject) => {
      let sql = `select * from work_time_allow order by initial_at desc limit 10`;
      // run query
      connection.query(sql, [], (err, results) => {
        if (err) reject(err);
        else resolve(results);
        // release connection
        // connection.release();
      });
    });
  }

  removeOldProcess(connection: IConnection, start, end) {
    return new Promise((resolve, reject) => {
      let sql = `delete from t_attendances where work_date between ? and ?`;
      // run query
      connection.query(sql, [start, end], (err, results) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  removeOldProcessIndividual(connection: IConnection, employeeCode, start, end) {
    return new Promise((resolve, reject) => {
      let sql = `delete from t_attendances where work_date between ? and ? and employee_code=?`;
      // run query
      connection.query(sql, [start, end, employeeCode], (err, results) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  getInitialEmployees(connection: IConnection, start, end) {
    return new Promise((resolve, reject) => {
      let sql = `
      select distinct employee_code 
      from employees as e 
      where employee_code not in (
        select distinct employee_code
        from work_type_attendances
        where work_date between ? and ?
      )
      `;
      // run query
      connection.query(sql, [start, end], (err, results) => {
        if (err) reject(err);
        else resolve(results);
        // release connection
        // connection.release();
      });
    });
  }

  saveProcessLog(connection: IConnection, processAt, start, end, total) {
    return new Promise((resolve, reject) => {
      let sql = `
      insert into processed_logs(process_at, start_date, end_date, total)
      values(?, ?, ?, ?)
      `;
      // run query
      connection.query(sql, [processAt, start, end, total], (err, results) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  saveInitialLog(connection: IConnection, initialAt, year, month) {
    return new Promise((resolve, reject) => {
      let sql = `
      insert into work_time_allow(initial_at, iyear, imonth)
      values(?, ?, ?)
      `;
      // run query
      connection.query(sql, [initialAt, year, month], (err, results) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  saveInitial(connection: IConnection, data) {
    return new Promise((resolve, reject) => {
      let sql = `
      insert into work_type_attendances(employee_code, work_date, work_type, is_process)
      values ?
      `;
      // run query
      connection.query(sql, [data], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  getEmployeeDetail(connection: IConnection, employeeCode) {
    return new Promise((resolve, reject) => {
      let sql = `
      select e.employee_code, e.employee_name,
      d.name as department_name
      from employees as e
      left join departments as d on d.id=e.department_id
      where e.employee_code=?
      limit 1
      `;
      // run query
      connection.query(sql, [employeeCode], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  getEmployeeWorkDetail(connection: IConnection, employeeCode, start, end) {
    return new Promise((resolve, reject) => {
      let sql = `
      select date_format(t.work_date, '%Y-%m-%d') as work_date,
      (
        select in_morning from t_attendances where employee_code=t.employee_code and work_date=t.work_date
        and work_type='1' limit 1
      ) as in01,
      (
        select in_afternoon from t_attendances where employee_code=t.employee_code and work_date=t.work_date
        and work_type='2' limit 1
      ) as in02,
      (
        select in_evening from t_attendances where employee_code=t.employee_code and work_date=t.work_date
        and work_type='3' limit 1
      ) as in03,
      (
        select in_evening2 from t_attendances where employee_code=t.employee_code and work_date=t.work_date
        and work_type='3' limit 1
      ) as in03_2,
      (
        select out_morning from t_attendances where employee_code=t.employee_code and work_date=t.work_date
        and work_type='1' limit 1
      ) as out01,
      (
        select out_afternoon from t_attendances where employee_code=t.employee_code and work_date=t.work_date
        and work_type='2' limit 1
      ) as out02,
      (
        select out_afternoon2 from t_attendances where employee_code=t.employee_code and work_date=t.work_date
        and work_type='2' limit 1
      ) as out02_2,
      (
        select out_evening from t_attendances where employee_code=t.employee_code and work_date=t.work_date
        and work_type='3' limit 1
      ) as out03
      from t_attendances as t

      where t.employee_code=?
      and t.work_date between ? and ?
      group by t.work_date
      order by t.work_date
      `;
      // run query
      connection.query(sql, [employeeCode, start, end], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  processSummary(connection: IConnection, start, end) {

    let workLateTime = process.env.WORK_LATE_TIME;
    let outBeforTime = process.env.OUT_BEFOR_TIME;

    return new Promise((resolve, reject) => {
      let sql = `
          select e.employee_code, e.employee_name,
          d.name as department_name,
          (
            select count(distinct work_date) as total
            from t_attendances as t
            where t.in_morning is not null
            and t.work_date between '${start}' and '${end}'
            and t.employee_code=e.employee_code
          ) +
          (
            select count(distinct work_date) as total
            from t_attendances as t
            where t.in_afternoon is not null
            and t.work_date between '${start}' and '${end}'
            and t.employee_code=e.employee_code
          )
          +
          (
            select count(distinct work_date) as total
            from t_attendances as t
            where (t.in_evening is not null or t.in_evening2 is not null)
            and t.work_date between '${start}' and '${end}'
            and t.employee_code=e.employee_code
          ) as total_work,
          (
            select count(distinct work_date) as total
            from t_attendances as t
            where t.work_type='1'
            and t.in_morning is not null
            and t.in_morning >= '${workLateTime}'
            and t.work_date between '${start}' and '${end}'
            and t.employee_code=e.employee_code
          ) as total_late,
          (
            select count(distinct work_date) as total
            from t_attendances as t
            where t.work_type='1'
            and t.in_morning is not null
            and t.out_morning <= '${outBeforTime}' and t.out_morning is not null
            and t.work_date between '${start}' and '${end}'
            and t.employee_code=e.employee_code
          ) as total_exit_before,
          (
            select count(distinct work_date) as total
            from t_attendances as t
            where t.work_type='1'
            and t.in_morning is not null
            and t.out_morning is null
            and t.work_date between '${start}' and '${end}'
            and t.employee_code=e.employee_code
          ) as total_not_exit

          from employees as e
          left join departments as d on d.id=e.department_id
          order by e.employee_name
      `;
      // run query
      connection.query(sql, [start, end], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  doProcess(connection: IConnection, start, end) {
    return new Promise((resolve, reject) => {
      let sql = `
              insert into t_attendances(employee_code, work_date, work_type, in_morning,
        in_afternoon, in_evening, in_evening2, out_morning, out_afternoon, out_afternoon2, out_evening)

        select st.employee_code, st.work_date, st.work_type,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=st.work_date
          and checkin_time between '04:00:00' and '09:45:59' and st.work_type='1' order by checkin_time limit 1
        ) as in_morning,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=st.work_date
          and checkin_time between '15:00:00' and '17:45:59' and st.work_type='2' order by checkin_time limit 1
        ) as in_afternoon,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=st.work_date
          and checkin_time between '23:00:00' and '23:59:59' and st.work_type='3' order by checkin_time limit 1
        ) as in_evening,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=date_add(st.work_date, interval 1 day)
          and checkin_time between '00:00:00' and '01:45:59' and st.work_type='3' order by checkin_time limit 1
        ) as in_evening2,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=st.work_date
          and checkin_time between '15:30:00' and '19:00:00' and st.work_type='1' order by checkin_time limit 1
        ) as out_morning,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=st.work_date
          and checkin_time between '19:45:00' and '23:59:59' and st.work_type='2' order by checkin_time limit 1
        ) as out_afternoon,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=date_add(st.work_date, interval 1 day)
          and checkin_time between '00:00:00' and '01:45:59' and st.work_type='2' order by checkin_time limit 1
        ) as out_afternoon2,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=date_add(st.work_date, interval 1 day)
          and checkin_time between '08:00:00' and '09:45:59' and st.work_type='3' order by checkin_time limit 1
        ) as out_evening
        from work_type_attendances as st
        where st.work_date between ? and ?
        order by st.work_date
      `;
      // run query
      connection.query(sql, [start, end], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  doProcessIndividual(connection: IConnection, employeeCode, start, end) {
    return new Promise((resolve, reject) => {
      let sql = `
        insert into t_attendances(employee_code, work_date, work_type, in_morning,
        in_afternoon, in_evening, in_evening2, out_morning, out_afternoon, out_afternoon2, out_evening)

        select st.employee_code, st.work_date, st.work_type,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=st.work_date
          and checkin_time between '04:00:00' and '09:45:59' and st.work_type='1' order by checkin_time limit 1
        ) as in_morning,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=st.work_date
          and checkin_time between '15:00:00' and '17:45:59' and st.work_type='2' order by checkin_time limit 1
        ) as in_afternoon,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=st.work_date
          and checkin_time between '23:00:00' and '23:59:59' and st.work_type='3' order by checkin_time limit 1
        ) as in_evening,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=date_add(st.work_date, interval 1 day)
          and checkin_time between '00:00:00' and '01:45:59' and st.work_type='3' order by checkin_time limit 1
        ) as in_evening2,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=st.work_date
          and checkin_time between '15:30:00' and '19:00:00' and st.work_type='1' order by checkin_time limit 1
        ) as out_morning,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=st.work_date
          and checkin_time between '19:45:00' and '23:59:59' and st.work_type='2' order by checkin_time limit 1
        ) as out_afternoon,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=date_add(st.work_date, interval 1 day)
          and checkin_time between '00:00:00' and '01:45:59' and st.work_type='2' order by checkin_time limit 1
        ) as out_afternoon2,
        (
          select checkin_time from attendances where employee_code=st.employee_code
          and checkin_date=date_add(st.work_date, interval 1 day)
          and checkin_time between '08:00:00' and '09:45:59' and st.work_type='3' order by checkin_time limit 1
        ) as out_evening
        from work_type_attendances as st
        where st.work_date between ? and ?
        and st.employee_code=?
        order by st.work_date
      `;
      // run query
      connection.query(sql, [start, end, employeeCode], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

}