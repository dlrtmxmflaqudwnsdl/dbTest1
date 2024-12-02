require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Helper function for query execution
const executeQuery = async (query, params, res) => {
    try {
        const [rows] = await db.query(query, params);
        return rows;
    } catch (err) {
        console.error(err);
        res.status(500).send({ status: 'error', message: 'Database query failed.' });
        return null;
    }
};

// 승인된 휴가 조회
app.get('/approved-leaves', async (req, res) => {
    const query = `
        SELECT                                  
            E.id AS employee_id,
            E.name AS employee_name,
            L.start_date,
            L.end_date,
            L.approval_status
        FROM 
            LEAVE_RECORD L
        JOIN 
            EMPLOYEE E ON L.employee_id = E.id
        WHERE 
            L.approval_status = 1
    `;
    const result = await executeQuery(query, [], res);
    res.json(result);
});

// 사용한 휴가 일수 조회
app.get('/used-leave', async (req, res) => {
    const query = `
        SELECT 
            E.id AS employee_id,
            E.name AS employee_name,
            SUM(DATEDIFF(L.end_date, L.start_date) + 1) AS total_used_leave_days
        FROM 
            LEAVE_RECORD L
        JOIN 
            EMPLOYEE E ON L.employee_id = E.id
        WHERE 
            L.approval_status = 1
        GROUP BY 
            E.id, E.name
    `;
    const result = await executeQuery(query, [], res);
    res.json(result);
});

// 잔여 휴가 일수 조회
app.get('/remaining-leave', async (req, res) => {
    const query = `
        SELECT 
            E.id AS employee_id,
            E.name AS employee_name,
            LR.remaining_annual_leave,
            LR.remaining_sick_leave,
            LR.remaining_special_leave,
            LR.remaining_annual_leave - COALESCE(SUM(DATEDIFF(L.end_date, L.start_date) + 1), 0) AS remaining_annual_leave_after_usage
        FROM 
            LEAVE_REMAINING LR
        JOIN 
            EMPLOYEE E ON LR.employee_id = E.id
        LEFT JOIN 
            LEAVE_RECORD L ON L.employee_id = E.id AND L.approval_status = 1
        GROUP BY 
            E.id, E.name, LR.remaining_annual_leave, LR.remaining_sick_leave, LR.remaining_special_leave
    `;
    const result = await executeQuery(query, [], res);
    res.json(result);
});

// 급여 지급 목록 조회
app.get('/salary-payments', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                E.id AS employee_id,
                E.name AS employee_name,
                S.payment_date,
                S.base_salary,
                S.incentive
            FROM 
                SALARY_PAYMENT_RECORD S
            JOIN 
                EMPLOYEE E ON S.employee_id = E.id
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('급여 지급 데이터를 가져오는 중 오류가 발생했습니다.');
    }
});

// 베스트 인센티브 직원 조회
app.get('/best-incentives', async (req, res) => {
    try {
        // Set variables for the date range
        const [firstDay] = await db.query(`SELECT DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') AS first_day`);
        const [lastDay] = await db.query(`SELECT LAST_DAY(CURRENT_DATE) AS last_day`);

        const firstDayValue = firstDay[0].first_day;
        const lastDayValue = lastDay[0].last_day;

        // Execute the main query
        const [rows] = await db.query(
            `
            SELECT 
                s.employee_id, 
                e.name AS employee_name,
                SUM(s.incentive) AS total_incentive  
            FROM 
                SALARY_PAYMENT_RECORD s
            JOIN 
                EMPLOYEE e ON s.employee_id = e.id  
            WHERE 
                s.payment_date BETWEEN ? AND ?  
            GROUP BY 
                s.employee_id, e.name
            ORDER BY 
                total_incentive DESC  
            LIMIT 3
        `,
            [firstDayValue, lastDayValue]
        );

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('베스트 인센티브 데이터를 가져오는 중 오류가 발생했습니다.');
    }
});


// // 우수 직원 조회
// app.get('/excellent-employee', async (req, res) => {
//     const query = `
//         SET @first_day = DATE_FORMAT(CURRENT_DATE, '%Y-%m-01');
//         SET @last_day = LAST_DAY(CURRENT_DATE);
//         SET @best_employee_id = (
//             SELECT s.employee_id
//             FROM SALARY_PAYMENT_RECORD s
//             JOIN EMPLOYEE e ON s.employee_id = e.id
//             WHERE s.payment_date BETWEEN @first_day AND @last_day
//             GROUP BY s.employee_id, e.name
//             ORDER BY SUM(s.incentive) DESC
//             LIMIT 1
//         );
//         SELECT @best_employee_id;
//     `;
//     const result = await executeQuery(query, [], res);
//     res.json(result || { message: '우수 직원 데이터가 없습니다.' });
// });

// 특정 직원의 잔여 특별 휴가 조회
app.get('/special-leave/:employeeId', async (req, res) => {
    const { employeeId } = req.params;
    try {
        const query = `
            SELECT 
                employee_id,
                remaining_special_leave
            FROM 
                LEAVE_REMAINING
            WHERE 
                employee_id = ?
        `;
        const [rows] = await db.query(query, [employeeId]);

        if (rows.length > 0) {
            res.json(rows[0]); // 결과가 있는 경우 첫 번째 행 반환
        } else {
            res.status(404).json({ message: '직원 데이터를 찾을 수 없습니다.' }); // 데이터가 없을 때 메시지 반환
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('잔여 특별 휴가 데이터를 가져오는 중 오류가 발생했습니다.');
    }
});

// 특정 직원의 특별 휴가 포상 추가
app.post('/special-leave/reward/:employeeId', async (req, res) => {
    const { employeeId } = req.params;
    try {
        const updateQuery = `
            UPDATE LEAVE_REMAINING
            SET remaining_special_leave = remaining_special_leave + 2
            WHERE employee_id = ?
        `;
        const [updateResult] = await db.query(updateQuery, [employeeId]);

        if (updateResult.affectedRows > 0) {
            // 업데이트 성공 후 잔여 특별 휴가 조회
            const selectQuery = `
                SELECT 
                    employee_id,
                    remaining_special_leave
                FROM 
                    LEAVE_REMAINING
                WHERE 
                    employee_id = ?
            `;
            const [rows] = await db.query(selectQuery, [employeeId]);

            if (rows.length > 0) {
                res.json(rows[0]); // 업데이트 후 최신 데이터 반환
            } else {
                res.status(404).json({ message: '업데이트 후 데이터를 찾을 수 없습니다.' });
            }
        } else {
            res.status(404).json({ message: '직원 데이터를 찾을 수 없습니다.' }); // 업데이트 실패 시 메시지 반환
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('특별 휴가 포상 추가 중 오류가 발생했습니다.');
    }
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
