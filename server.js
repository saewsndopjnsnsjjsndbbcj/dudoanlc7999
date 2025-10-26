// server_vip_pro_final_production.js
// Node.js + Express - BOT DỰ ĐOÁN SIÊU VIP PRO (Tài/Xỉu)
// - THUẬT TOÁN: ALL-IN-ONE MULTI-STRATEGY (Bệt, Đảo 1-1, Sát Lực, Thuận Trend)
// - Độ tin cậy HOÀN TOÀN NGẪU NHIÊN 50-90%
// - Thống kê Chính xác: Dự đoán phiên nào lưu phiên đó, so sánh với KQ thực tế.
// - Pattern 10 cầu hiển thị ngắn gọn (T/X)
// Chạy: node server_vip_pro_final_production.js

const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- CẤU HÌNH --------------------
// Thay thế bằng URL API lịch sử của bạn
const HISTORY_API_URL = process.env.HISTORY_API_URL || "https://jjj-c53c.onrender.com/api/lxk"; 
const RECENT_COUNT_TREND = 15; // 15 phiên cho xu hướng chung (Thuận Trend)
const RECENT_COUNT_PATTERN = 10; // 10 phiên cho Pattern ngắn (chuỗi T/X hiển thị)
const CONF_MIN = 50.0; // % Độ tin cậy tối thiểu (Random)
const CONF_MAX = 90.0; // % Độ tin cậy tối đa (Random)

// -------------------- THỐNG KÊ & CACHE --------------------
let thongKeNgay = {
    ngay: getDateVN(),
    tong: 0, 
    dung: 0,
    sai: 0
};

// Lưu chi tiết phiên đã dự đoán gần nhất
let cacheDuDoan = {
    phienDuDoan: null,     // Phiên bot đã dự đoán
    duDoan: "Đang chờ",    // Dự đoán của bot
    doTinCay: "0.0%",      // Độ tin cậy ngẫu nhiên
    chuoiPattern: "",      // Chuỗi T/X 10 phiên
    ketQuaThucTe: null,     // Kết quả thực tế của phiên này (sau khi có)
    daCapNhatThongKe: false // Trạng thái: Đã cập nhật thống kê ĐÚNG/SAI cho phiên này chưa?
};

// -------------------- HỖ TRỢ NGÀY GIỜ VN --------------------
function getTimeVN() {
    return new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}
function getDateVN() {
    return new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

// -------------------- RESET THỐNG KÊ 00:00 VN --------------------
function resetThongKeNgay() {
    thongKeNgay = { ngay: getDateVN(), tong: 0, dung: 0, sai: 0 };
    cacheDuDoan = {
        phienDuDoan: null, duDoan: "Đang chờ", doTinCay: "0.0%", 
        chuoiPattern: "", ketQuaThucTe: null, daCapNhatThongKe: false
    };
    console.log(`[${getTimeVN()}] -> Đã reset thống kê hàng ngày và cache.`);
}

// Lên lịch reset lúc 00:00 VN
(function scheduleMidnightReset() {
    try {
        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
        const nextMidnight = new Date(now);
        nextMidnight.setHours(24, 0, 0, 0);
        const ms = nextMidnight - now;
        setTimeout(() => {
            resetThongKeNgay();
            setInterval(resetThongKeNgay, 24 * 60 * 60 * 1000);
        }, ms);
    } catch (e) {
        console.warn("Không thể lên lịch reset tự động.");
    }
})();

// Hàm kiểm tra và reset thống kê nếu sang ngày mới
function resetIfNewDayAndKeep() {
    const today = getDateVN();
    if (thongKeNgay.ngay !== today) {
        resetThongKeNgay();
    }
}

// -------------------- HÀM HỖ TRỢ CHUNG --------------------

function randConfidence(min = CONF_MIN, max = CONF_MAX) {
    const r = Math.random() * (max - min) + min;
    return r.toFixed(1) + "%";
}

// Chuẩn hoá kết quả thành T (Tài) hoặc X (Xỉu) - Dùng trong logic nội bộ/pattern
function normalizeResultInternal(val) {
    if (!val && val !== "") return "";
    const s = String(val).trim().toLowerCase();
    if (s === "tài" || s.includes("t")) return "T";
    if (s === "xỉu" || s.includes("x")) return "X";
    return "";
}

// Chuẩn hoá kết quả thành "Tài" hoặc "Xỉu" - Dùng cho API trả về/thống kê
function normalizeResultExternal(val) {
    const internal = normalizeResultInternal(val);
    if (internal === "T") return "Tài";
    if (internal === "X") return "Xỉu";
    return "";
}

// -------------------- THUẬT TOÁN SIÊU VIP PRO (MULTI-STRATEGY) --------------------
/**
 * Thuật toán đa chiến lược, ưu tiên bắt các cầu ngắn phổ biến (Thuận Cầu/Trend).
 */
function superVipProPredict(historyArray) {
    const recent = Array.isArray(historyArray) ? historyArray : [];
    let duDoanInternal = null; 
    let logMessage = "Không xác định";
    
    // Lấy chuỗi T/X cho 10 phiên gần nhất (Pattern)
    const patternData = recent.slice(0, RECENT_COUNT_PATTERN);
    const chuoiPattern = patternData.map(item => normalizeResultInternal(item.Ket_qua || item.ket_qua)).join('');
    
    
    // --- BƯỚC 1: BẮT CẦU BỆT (Ưu tiên cao nhất: 3+ phiên) ---
    const last3 = chuoiPattern.substring(0, 3);
    if (last3.length >= 3 && last3.includes(last3[0].repeat(3))) {
        duDoanInternal = last3[0]; 
        logMessage = `Bắt Cầu Bệt ${last3[0].repeat(3)}`;
    }

    // --- BƯỚC 2: BẮT CẦU ĐẢO 1-1 (4 phiên -> dự đoán tiếp 1-1) ---
    if (duDoanInternal === null) {
        const last4 = chuoiPattern.substring(0, 4);
        if (last4.length === 4) {
            // Kiểm tra TXTX hoặc XTXT
            if (last4 === "TXTX" || last4 === "XTXT") {
                // Dự đoán ngược lại phiên cuối (TXTX -> Dự đoán T / XTXT -> Dự đoán X)
                duDoanInternal = last4[3] === "T" ? "X" : "T"; 
                logMessage = `Bắt Cầu Đảo 1-1 (${last4[3]} -> ${duDoanInternal})`;
            }
        }
    }
    
    // --- BƯỚC 3: BẮT CẦU SÁT LỰC (2-1-2 / 3-2-3, dùng 6 phiên) ---
    if (duDoanInternal === null) {
        const last6 = chuoiPattern.substring(0, 6);
        if (last6.length === 6) {
            // Cầu 2-1-2 (ví dụ: T T X T T X) -> Dự đoán T
            if (last6[0] === last6[1] && last6[3] === last6[4] && last6[1] !== last6[2] && last6[2] === last6[5] && last6[0] === last6[3]) {
                 duDoanInternal = last6[0]; 
                 logMessage = `Bắt Cầu Sát Lực 2-1-2 (${last6})`;
            }
            // Cầu 3-2-3 (ví dụ: T T T X X T) -> Dự đoán X
            else if (last6[0] === last6[1] && last6[0] === last6[2] && last6[3] === last6[4] && last6[2] !== last6[3] && last6[4] !== last6[5] && last6[5] === last6[2]) {
                duDoanInternal = last6[0]; 
                logMessage = `Bắt Cầu Sát Lực 3-2-3 (${last6})`;
            }
        }
    }
    
    // --- BƯỚC 4: DỰ ĐOÁN THUẬN TREND LỚN (15 phiên) ---
    if (duDoanInternal === null) {
        const trendData = recent.slice(0, RECENT_COUNT_TREND);
        let countT = 0, countX = 0;
        trendData.forEach(item => {
            const kq = normalizeResultInternal(item.Ket_qua || item.ket_qua);
            if (kq === "T") countT++;
            else if (kq === "X") countX++;
        });

        if (countT + countX > 0) {
            if (countT > countX) { 
                duDoanInternal = "T"; 
                logMessage = "Bắt Thuận Trend Lớn Tài (15p)";
            } else if (countX > countT) { 
                duDoanInternal = "X"; 
                logMessage = "Bắt Thuận Trend Lớn Xỉu (15p)";
            } else { 
                duDoanInternal = Math.random() < 0.5 ? "T" : "X"; 
                logMessage = "Cân bằng, Random";
            }
        } else {
            duDoanInternal = Math.random() < 0.5 ? "T" : "X";
            logMessage = "Không đủ data, Random";
        }
    }
    
    const duDoanExternal = duDoanInternal === "T" ? "Tài" : (duDoanInternal === "X" ? "Xỉu" : "Đang chờ");

    return { duDoan: duDoanExternal, chuoiPattern, logMessage };
}


// -------------------- CẬP NHẬT ĐÚNG/SAI KHI CÓ KQ THỰC TẾ --------------------
function checkAndUpdateAccuracy(latest) {
    try {
        // Sử dụng Phien (chữ hoa) vì API của bạn có thể trả về Phien thay vì phien
        if (!latest || latest.Phien === undefined || !cacheDuDoan.phienDuDoan) return; 

        const predictedPhien = String(cacheDuDoan.phienDuDoan);
        const latestPhien = String(latest.Phien);

        // Kiểm tra xem phiên gần nhất có phải là phiên ta đã dự đoán không
        if (predictedPhien === latestPhien) {
            
            const actual = normalizeResultExternal(latest.Ket_qua || latest.ket_qua); 
            const predicted = cacheDuDoan.duDoan; 
            
            // Chỉ cập nhật nếu kết quả thực tế là Tài/Xỉu VÀ chưa cập nhật thống kê
            if((actual === "Tài" || actual === "Xỉu") && !cacheDuDoan.daCapNhatThongKe) {
                
                // CẬP NHẬT THỐNG KÊ ĐÚNG/SAI
                if (actual === predicted) {
                    thongKeNgay.dung = (thongKeNgay.dung || 0) + 1;
                    console.log(`[${getTimeVN()}] -> Phiên ${latestPhien}: DỰ ĐOÁN ĐÚNG! (${predicted} vs ${actual}).`);
                } else {
                    thongKeNgay.sai = (thongKeNgay.sai || 0) + 1;
                    console.log(`[${getTimeVN()}] -> Phiên ${latestPhien}: DỰ ĐOÁN SAI! (${predicted} vs ${actual}).`);
                }
                
                cacheDuDoan.daCapNhatThongKe = true; 
            } 
            
            // LƯU KẾT QUẢ THỰC TẾ VÀO CACHE CỦA PHIÊN ĐÓ
            if (actual === "Tài" || actual === "Xỉu") {
                cacheDuDoan.ketQuaThucTe = actual; 
            }
        }

    } catch (e) {
        console.warn("checkAndUpdateAccuracy error:", e && e.message ? e.message : e);
    }
}

// -------------------- ENDPOINT: /api/lookup_predict --------------------
app.get("/api/lookup_predict", async (req, res) => {
    try {
        const response = await axios.get(HISTORY_API_URL, { timeout: 7000 });
        // Sửa lỗi: Đảm bảo dữ liệu là mảng, xử lý trường hợp API trả về object đơn lẻ
        const rawData = Array.isArray(response.data) ? response.data : (response.data && response.data.Phien !== undefined ? [response.data] : []);
        
        if (rawData.length === 0) {
            return res.status(200).json({
                id: "VIP_PRO_001",
                time_vn: getTimeVN(),
                error: "Không có dữ liệu lịch sử",
                thong_ke: thongKeNgay
            });
        }

        resetIfNewDayAndKeep();

        // 1. Cập nhật thống kê và lưu kết quả thực tế của phiên trước đó (nếu có)
        checkAndUpdateAccuracy(rawData[0]);

        // Xác định phiên gần nhất và phiên dự đoán tiếp theo
        const phienGanNhat = (rawData[0] && rawData[0].Phien !== undefined) ? String(rawData[0].Phien) : "N/A";
        // Đảm bảo Phien là số trước khi tăng 1
        const phienDuDoanTiepTheo = (phienGanNhat !== "N/A" && phienGanNhat.match(/^\d+$/)) ? String(parseInt(phienGanNhat) + 1) : "N/A";
        const ketQuaGanNhat = normalizeResultExternal(rawData[0].Ket_qua || rawData[0].ket_qua); 

        // 2. Trả về cache nếu phiên hiện tại vẫn đang chờ kết quả 
        if (cacheDuDoan.phienDuDoan === phienDuDoanTiepTheo && phienDuDoanTiepTheo !== "N/A") {
            resetIfNewDayAndKeep();
            return res.json({
                id: "VIP_PRO_001_CACHE",
                time_vn: getTimeVN(),
                phien_gan_nhat: phienGanNhat,
                ket_qua_gan_nhat: ketQuaGanNhat,
                phien_du_doan: cacheDuDoan.phienDuDoan,
                du_doan: cacheDuDoan.duDoan,
                do_tin_cay: cacheDuDoan.doTinCay,
                chuoi_pattern: cacheDuDoan.chuoiPattern, 
                ket_qua_thuc_te_phien_du_doan: cacheDuDoan.ketQuaThucTe, 
                thong_ke: thongKeNgay
            });
        }
        
        // --- TÍNH DỰ ĐOÁN MỚI CHO PHIÊN TIẾP THEO ---
        const { duDoan, chuoiPattern, logMessage } = superVipProPredict(rawData); 
        const doTinCay = randConfidence(); 

        // 3. Cập nhật cache và tăng tổng dự đoán (chỉ khi có dự đoán mới)
        cacheDuDoan = {
            phienDuDoan: phienDuDoanTiepTheo,
            duDoan, 
            doTinCay,
            chuoiPattern,
            ketQuaThucTe: null, 
            daCapNhatThongKe: false
        };

        resetIfNewDayAndKeep();
        thongKeNgay.tong = (thongKeNgay.tong || 0) + 1; 
        
        console.log(`[${getTimeVN()}] -> DỰ ĐOÁN MỚI: Phiên ${phienDuDoanTiepTheo} là ${duDoan} (${logMessage})`);

        // 4. Trả về kết quả mới
        return res.json({
            id: "VIP_PRO_001",
            time_vn: getTimeVN(),
            phien_gan_nhat: phienGanNhat,
            ket_qua_gan_nhat: ketQuaGanNhat, 
            phien_du_doan: phienDuDoanTiepTheo,
            du_doan: duDoan, 
            do_tin_cay: doTinCay,
            chuoi_pattern: chuoiPattern,
            ket_qua_thuc_te_phien_du_doan: null, 
            thong_ke: thongKeNgay
        });

    } catch (err) {
        console.error("Lỗi chung khi xử lý dự đoán:", err && err.message ? err.message : err);
        return res.status(500).json({
            id: "VIP_PRO_001_ERR",
            time_vn: getTimeVN(),
            error: "Lỗi trong quá trình xử lý dữ liệu hoặc thuật toán.",
            thong_ke: thongKeNgay
        });
    }
});

// -------------------- ENDPOINT: /api/thongke --------------------
app.get("/api/thongke", (req, res) => {
    resetIfNewDayAndKeep();
    return res.json({
        id: "VIP_PRO_001_STATS",
        time_vn: getTimeVN(),
        thong_ke: thongKeNgay,
        cache_du_doan_gan_nhat: cacheDuDoan 
    });
});

// -------------------- TRANG CHỦ --------------------
app.get("/", (req, res) => {
    res.send("👑 SIÊU VIP PRO API đang chạy. Endpoint: /api/lookup_predict - Tiếng Việt");
});

// -------------------- RUN --------------------
app.listen(PORT, () => {
    console.log(`🚀 SIÊU VIP PRO server (MULTI-STRATEGY) chạy cổng ${PORT} - Time VN: ${getTimeVN()}`);
});
    
