const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// URL API gốc
const SOURCE_API_URL = 'https://wtx.tele68.com/v1/tx/sessions';

app.get('/api/lxk', async (req, res) => {
    try {
        const response = await axios.get(SOURCE_API_URL);
        const data = response.data;

        // Nếu dữ liệu nằm trong data.list
        const latestResult = data?.list?.[0] || data;

        if (!latestResult || !latestResult.id || !latestResult.dices) {
            return res.status(500).json({
                error: "Dữ liệu không hợp lệ",
                details: latestResult
            });
        }

        const dices = latestResult.dices;
        const point = latestResult.point;
        let ketQua = latestResult.resultTruyenThong;

        // Chuẩn hóa kết quả
        if (ketQua.toLowerCase() === "tai") ketQua = "Tài";
        else if (ketQua.toLowerCase() === "xiu") ketQua = "Xỉu";
        else ketQua = "bão";

        const result = {
            Ket_qua: ketQua,
            Phien: `${latestResult.id}`,
            Tong: point,
            Xuc_xac_1: dices[0],
            Xuc_xac_2: dices[1],
            Xuc_xac_3: dices[2],
            id: "@anhbaocx"
        };

        res.json(result);

    } catch (error) {
        console.error("Lỗi khi gọi API gốc:", error.message);
        res.status(500).json({
            error: "Không thể lấy dữ liệu từ API gốc.",
            details: error.message
        });
    }
});

app.get('/', (req, res) => {
    res.send('Chào mừng đến với API Lấy Phiên Gần Nhất. Truy cập /api/lxk để xem kết quả.');
});

app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});
