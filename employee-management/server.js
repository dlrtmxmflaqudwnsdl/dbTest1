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

// 서버 시작
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
