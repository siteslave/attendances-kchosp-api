import * as moment from 'moment';
import Knex = require('knex');

export class AttendancesModel {
  saveAttendances(knex: Knex, data: any) {
    let sqls = [];
    data.forEach(v => {
        let sql = `
          INSERT INTO attendances
          (employee_code, checkin_date, checkin_time, imported_date, device_code)
          VALUES('${v.employee_code}', '${v.checkin_date}', '${v.checkin_time}', 
          '${v.imported_date}', '${v.device_code}')
          ON DUPLICATE KEY UPDATE
          imported_date='${v.imported_date}'
        `;
      sqls.push(sql);
    });

    let queries = sqls.join(';');
    return knex.raw(queries);
  }

  saveImportedLog(knex: Knex, imported_at, start, end, total) {
    return knex('imported_logs')
      .insert({
        imported_at: imported_at,
        start_date: start,
        end_date: end,
        total: total
      });
  }

  removeAttendances(knex: Knex, start, end) {
    return knex('attendances')
      .whereBetween('checkin_date', [start, end])
      .del();
  }

  getImportedLog(knex: Knex) {
    return knex('imported_logs')
      .orderBy('imported_at', 'DESC')
      .limit(10);
  }

  getProcessLog(knex: Knex) {
    return knex('processed_logs')
      .orderBy('process_at', 'DESC')
      .limit(10);
  }

  getInitialLog(knex: Knex) {
    return knex('work_time_allow')
      .orderByRaw('concat(iyear, imonth) DESC')
      .limit(10);
  }

  removeOldProcess(knex: Knex, start, end) {
    return knex('t_attendances')
      .whereBetween('work_date', [start, end])
      .del();
  }

  removeOldProcessIndividual(knex: Knex, employeeCode, start, end) {
    return knex('t_attendances')
      .whereBetween('work_date', [start, end])
      .where('employee_code', employeeCode)
      .del();
  }

  getInitialEmployees(knex: Knex, start, end) {
    let sql = `
      select distinct employee_code 
      from employees as e 
      where employee_code not in (
        select distinct employee_code
        from work_type_attendances
        where work_date between ? and ?
      )
      and is_active='Y'
      `;
    return knex.raw(sql, [start, end]);
  }

  saveProcessLog(knex: Knex, processAt, start, end, total) {
    return knex('processed_logs')
      .insert({
        process_at: processAt,
        start_date: start,
        end_date: end,
        total: total
      });
  }

  saveInitialLog(knex: Knex, initialAt, year, month) {
    return knex('work_time_allow')
      .insert({
        initial_at: initialAt,
        iyear: year,
        imonth: month
      });
  }

  updateProcessStatus(knex: Knex, start, end) {
    return knex('work_type_attendances')
      .whereBetween('work_date', [start, end])
      .update({
        is_process: 'Y'
      });
  }

  saveInitial(knex: Knex, data) {
    return knex('work_type_attendances')
      .insert(data);
  }

  getEmployeeDetail(knex: Knex, employeeCode) {

    return knex('employees as e')
      .select(
      'e.id' ,'e.employee_code', knex.raw('concat(e.first_name, " ", e.last_name) as employee_name'),
      'd.name as department_name')
      .leftJoin('l_sub_departments as d', 'd.id', 'e.sub_department_id')
      .where('e.employee_code', employeeCode)
      .limit(1);
  }

  getEmployeeWorkDetail(knex: Knex, employeeCode, start, end) {
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
    return knex.raw(sql, [employeeCode, start, end]);
  }

  processSummary(knex: Knex, start, end) {

    let workLateTime = process.env.WORK_LATE_TIME;
    let outBeforTime = process.env.OUT_BEFOR_TIME;

    let sql = `
          select e.employee_code, concat(e.first_name, " ", e.last_name) as employee_name,
          d.name as department_name,
          (
            select count(distinct concat(DATE_FORMAT(wt.work_date,'%Y%m%d'), wt.work_type)) as total 
            from work_type_attendances as wt
            where wt.employee_code=e.employee_code and wt.work_date between '${start}' and '${end}'
            and wt.is_process='Y'
          ) as total_confirm,
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
          ) as total_not_exit,
          (
            select count(distinct m.meeting_date) as total
            from meeting_approve_dates as m
            where m.employee_id=e.id
            and m.meeting_date between '${start}' and '${end}'
          ) as meeting_total

          from employees as e
          left join l_sub_departments as d on d.id=e.sub_department_id
          where e.is_active='Y'
          order by e.first_name, e.last_name
      `;

    return knex.raw(sql);
  }

  doProcess(knex: Knex, start, end) {
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
        group by st.employee_code, st.work_date, st.work_type
        order by st.work_date
      `;
    return knex.raw(sql, [start, end]);
  }

  doProcessIndividual(knex: Knex, employeeCode, start, end) {
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
        group by st.employee_code, st.work_date, st.work_type
        order by st.work_date
      `;
    return knex.raw(sql, [start, end, employeeCode]);
  }
  
  getMeetingTotal(knex: Knex, employeeId, start, end) {
    let sql = `
    select count(distinct m.meeting_date) as total
    from meeting_approve_dates as m
    where m.employee_id=?
    and m.meeting_date between ? and ?
    `;

    return knex.raw(sql, [employeeId, start, end]);
  }



}