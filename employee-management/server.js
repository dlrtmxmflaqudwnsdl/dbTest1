const express = require('express');
const path = require('path');
const db = require('./db'); // db.js에서 MySQL 연결 가져오기

const app = express();
const PORT = 3000;

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'public')));

// 승인된 휴가 조회
app.get('/approved-leaves', async (req, res) => {
    try {
        const [rows] = await db.query(`
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
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('승인된 휴가 데이터를 가져오는 중 오류가 발생했습니다.');
    }
});

// 사용한 휴가 일수 조회
app.get('/used-leave', async (req, res) => {
    try {
        const [rows] = await db.query(`
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
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('사용한 휴가 데이터를 가져오는 중 오류가 발생했습니다.');
    }
});

// 잔여 휴가 일수 조회
app.get('/remaining-leave', async (req, res) => {
    try {
        const [rows] = await db.query(`
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
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('잔여 휴가 데이터를 가져오는 중 오류가 발생했습니다.');
    }
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
        const [rows] = await db.query(`
            SELECT 
                E.id AS employee_id,
                E.name AS employee_name,
                SUM(S.incentive) AS total_incentive
            FROM 
                SALARY_PAYMENT_RECORD S
            JOIN 
                EMPLOYEE E ON S.employee_id = E.id
            WHERE 
                MONTH(S.payment_date) = MONTH(CURRENT_DATE)
                AND YEAR(S.payment_date) = YEAR(CURRENT_DATE)
            GROUP BY 
                S.employee_id, E.id, E.name
            ORDER BY 
                total_incentive DESC
            LIMIT 3
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('베스트 인센티브 데이터를 가져오는 중 오류가 발생했습니다.');
    }
});


// 우수 직원 조회
app.get('/excellent-employee', async (req, res) => {
    try {
        const [[row]] = await db.query(`
            SELECT 
                E.id AS employee_id,
                E.name
            FROM 
                SALARY_PAYMENT_RECORD S
            JOIN 
                EMPLOYEE E ON S.employee_id = E.id
            WHERE 
                MONTH(S.payment_date) = MONTH(CURRENT_DATE)
                AND YEAR(S.payment_date) = YEAR(CURRENT_DATE)
            GROUP BY 
                S.employee_id, E.name
            ORDER BY 
                SUM(S.incentive) DESC
            LIMIT 1
        `);
        res.json(row || { message: '우수 직원 데이터가 없습니다.' });
    } catch (err) {
        console.error(err);
        res.status(500).send('우수 직원 데이터를 가져오는 중 오류가 발생했습니다.');
    }
});

// 특정 직원의 잔여 특별 휴가 조회
app.get('/special-leave/:employeeId', async (req, res) => {
    const { employeeId } = req.params;
    try {
        const [[row]] = await db.query(`
            SELECT 
                employee_id,
                remaining_special_leave
            FROM 
                LEAVE_REMAINING
            WHERE 
                employee_id = ?
        `, [employeeId]);
        res.json(row || { message: '직원 데이터를 찾을 수 없습니다.' });
    } catch (err) {
        console.error(err);
        res.status(500).send('잔여 특별 휴가 데이터를 가져오는 중 오류가 발생했습니다.');
    }
});

// 특정 직원의 특별 휴가 포상 추가
app.post('/special-leave/reward/:employeeId', async (req, res) => {
    const { employeeId } = req.params;
    try {
        await db.query(`
            UPDATE LEAVE_REMAINING
            SET remaining_special_leave = remaining_special_leave + 2
            WHERE employee_id = ?
        `, [employeeId]);
        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        res.status(500).send('특별 휴가 포상을 추가하는 중 오류가 발생했습니다.');
    }
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
