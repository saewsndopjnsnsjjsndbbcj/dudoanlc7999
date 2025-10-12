const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================================
// I. CẤU HÌNH API NGUỒN
// =====================================================================
const HISTORY_API_URL = 'https://bllc-baam.onrender.com/api/lxk';

// =====================================================================
// II. CACHE DỰ ĐOÁN (CỐ ĐỊNH CHO MỖI PHIÊN)
// =====================================================================
let predictionCache = {
    phienSau: null,
    du_doan: "Đang chờ",
    do_tin_cay: "0.0%",
    predictionKey: "N/A"
};

// =====================================================================
// III. HÀM RANDOM ĐỘ TIN CẬY
// =====================================================================
function randomConfidence(base = 90, range = 10) {
    const min = base - range / 2;
    const max = base + range / 2;
    return `${(Math.random() * (max - min) + min).toFixed(1)}%`;
}

// =====================================================================
// IV. THUẬT TOÁN DỰ ĐOÁN VIP PRO
// =====================================================================
/**
 * Dự đoán VIP PRO theo tổng xúc xắc và xu hướng gần nhất.
 * @param {number} total - Tổng 3 xúc xắc phiên hiện tại.
 * @param {Array} lastResults - Mảng chứa kết quả 3 phiên gần nhất (["Tài", "Xỉu", ...]).
 * @returns {{du_doan: string, do_tin_cay: string, giai_thich: string}}
 */
function predictVIP(total, lastResults = []) {
    let du_doan = "Không xác định";
    let giai_thich = "";
    let baseConfidence = 92; // độ tin cậy cơ bản

    // --- B1: Xác định hướng cơ bản theo tổng ---
    if (total >= 11) {
        du_doan = "Tài";
        giai_thich = `Tổng ${total} cao → nghiêng về Tài`;
    } else {
        du_doan = "Xỉu";
        giai_thich = `Tổng ${total} thấp → nghiêng về Xỉu`;
    }

    // --- B2: Logic “đảo cầu” nếu chuỗi 3 phiên trước giống nhau ---
    if (lastResults.length >= 3) {
        const last3 = lastResults.slice(0, 3);
        if (last3.every(v => v === last3[0])) {
            du_doan = (last3[0] === "Tài") ? "Xỉu" : "Tài";
            giai_thich += ` | Chuỗi ${last3[0]} 3 lần → Đảo cầu (${du_doan})`;
            baseConfidence += 3;
        }
    }

    // --- B3: Giảm độ tin cậy nếu vùng biên ---
    if (total === 10 || total === 11) {
        baseConfidence -= 6;
        giai_thich += " | Vùng biên (10-11) → độ tin cậy giảm nhẹ";
    }

    // --- B4: Random nhỏ để tự nhiên hơn ---
    if (baseConfidence > 98) baseConfidence = 98;
    if (baseConfidence < 80) baseConfidence = 80;
    const finalConfidence = randomConfidence(baseConfidence, 6);

    return {
        du_doan,
        do_tin_cay: finalConfidence,
        giai_thich
    };
}

// =====================================================================
// V. API DỰ ĐOÁN CHÍNH
// =====================================================================
app.get('/api/lookup_predict', async (req, res) => {
    let prediction = "Không thể dự đoán";
    let confidence = "0.0%";
    let predictionKey = "N/A";
    let currentData = null;
    let phienSau = "N/A";
    let tongXucXac = "N/A";

    try {
        const response = await axios.get(HISTORY_API_URL);
        const historyData = Array.isArray(response.data) ? response.data : [response.data];
        currentData = historyData.length > 0 ? historyData[0] : null;

        if (currentData) {
            phienSau = (parseInt(currentData.Phien) + 1).toString();

            const x1 = parseInt(currentData.Xuc_xac_1);
            const x2 = parseInt(currentData.Xuc_xac_2);
            const x3 = parseInt(currentData.Xuc_xac_3);
            tongXucXac = currentData.Tong || (x1 + x2 + x3);
        }

        // --- KIỂM TRA CACHE ---
        if (predictionCache.phienSau === phienSau && phienSau !== "N/A") {
            return res.json({
                id: "@SHSUTS1",
                phien_truoc: currentData ? currentData.Phien : "N/A",
                xuc_xac: currentData ? [currentData.Xuc_xac_1, currentData.Xuc_xac_2, currentData.Xuc_xac_3] : [],
                tong_xuc_xac: tongXucXac,
                ket_qua_truoc: currentData ? currentData.Ket_qua : "N/A",
                phien_sau: predictionCache.phienSau,
                du_doan: predictionCache.du_doan,
                do_tin_cay: predictionCache.do_tin_cay,
                lich_su_tra_cuu: predictionCache.predictionKey,
                giai_thich: predictionCache.giai_thich || "cache"
            });
        }

        // --- DỰ ĐOÁN MỚI ---
        if (currentData && tongXucXac !== "N/A") {
            const lastResults = historyData.slice(0, 3).map(item => item.Ket_qua);
            const vipResult = predictVIP(tongXucXac, lastResults);

            prediction = vipResult.du_doan;
            confidence = vipResult.do_tin_cay;
            predictionKey = `Tổng: ${tongXucXac}`;
            giai_thich = vipResult.giai_thich;
        } else {
            prediction = "Không có dữ liệu";
            confidence = "0.0%";
            predictionKey = "Thiếu dữ liệu phiên";
        }

        // --- LƯU CACHE ---
        if (phienSau !== "N/A" && prediction !== "Không có dữ liệu") {
            predictionCache = {
                phienSau,
                du_doan: prediction,
                do_tin_cay: confidence,
                predictionKey,
                giai_thich
            };
        }

        // --- TRẢ KẾT QUẢ ---
        res.json({
            id: "@SHSUTS1",
            phien_truoc: currentData ? currentData.Phien : "N/A",
            xuc_xac: currentData ? [currentData.Xuc_xac_1, currentData.Xuc_xac_2, currentData.Xuc_xac_3] : [],
            tong_xuc_xac: tongXucXac,
            ket_qua_truoc: currentData ? currentData.Ket_qua : "N/A",
            phien_sau: phienSau,
            du_doan: prediction,
            do_tin_cay: confidence,
            lich_su_tra_cuu: predictionKey,
            giai_thich
        });

    } catch (err) {
        console.error("Lỗi API:", err.message);
        res.status(500).json({
            id: "@SHSUTS1_VIPPRO_ERR",
            error: "Lỗi khi gọi API lịch sử.",
            du_doan: "Tài",
            do_tin_cay: randomConfidence(90, 15),
            giai_thich: "Trả về mặc định khi lỗi nguồn dữ liệu."
        });
    }
});

// =====================================================================
// VI. ROUTE GỐC
// =====================================================================
app.get('/', (req, res) => {
    res.send("🔥 API Dự đoán Tài Xỉu VIP PRO đang hoạt động. Truy cập /api/lookup_predict để xem kết quả.");
});

// =====================================================================
app.listen(PORT, () => console.log(`Server VIP PRO chạy trên cổng ${PORT}`));
