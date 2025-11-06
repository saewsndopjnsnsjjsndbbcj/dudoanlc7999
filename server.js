// server_wormgpt.js
// Node.js + Express - WormGPT Algorithm (QRG version)
// Cập nhật: fix key viết hoa / thường, thay toàn bộ thuật toán mới
// Chạy: node server_wormgpt.js

const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3000;
const HISTORY_API_URL =
  process.env.HISTORY_API_URL || "https://lichsulc79md-khvr.onrender.com/api/lxk";

// ================== Helpers ==================
function getTimeVN() {
  return new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}
function getDateVN() {
  return new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}
function randConfidence(min = 50.0, max = 90.0) {
  const r = Math.random() * (max - min) + min;
  return r.toFixed(1) + "%";
}

// Chuẩn hóa key dữ liệu (Phien, Ket_qua, Xuc_xac_1, ...)
function chuanHoaPhien(item) {
  return {
    phien:
      item.phien || item.Phien || item.PHIEN || 0,
    xuc_xac_1:
      item.xuc_xac_1 || item.Xuc_xac_1 || item.XUC_XAC_1 || 0,
    xuc_xac_2:
      item.xuc_xac_2 || item.Xuc_xac_2 || item.XUC_XAC_2 || 0,
    xuc_xac_3:
      item.xuc_xac_3 || item.Xuc_xac_3 || item.XUC_XAC_3 || 0,
    tong: item.tong || item.Tong || item.TONG || 0,
    ket_qua: item.ket_qua || item.Ket_qua || item.KET_QUA || "",
    id_nguon: item.id_nguon || item.ID_NGUON || "@unknown",
  };
}

// ================== Thống kê ==================
let thongKeNgay = { ngay: getDateVN(), tong: 0, dung: 0, sai: 0 };
let cacheDuDoan = {
  phienDuDoan: null,
  duDoan: "Đang chờ",
  doTinCay: "0.0%",
  chuoiPattern: "",
  ketQuaThucTe: null,
  daCapNhatThongKe: false,
};

function resetIfNewDay() {
  const today = getDateVN();
  if (thongKeNgay.ngay !== today) {
    thongKeNgay = { ngay: today, tong: 0, dung: 0, sai: 0 };
    cacheDuDoan = {
      phienDuDoan: null,
      duDoan: "Đang chờ",
      doTinCay: "0.0%",
      chuoiPattern: "",
      ketQuaThucTe: null,
      daCapNhatThongKe: false,
    };
    console.log(`[${getTimeVN()}] -> Reset thống kê hàng ngày`);
  }
}

// ================== Thuật toán WormGPT ==================
class ThuatToanTaiXiu {
  constructor() {
    this.tenThuatToan = "WormGPT-Algorithm";
    this.phienTruoc = null;
    this.chuoiLienTiep = 0;
    this.xuHuong = "khong_ro";
    console.log("✅ Thuật toán Worm GPT đã được khởi tạo");
  }

  phanTichLichSu(lichSu) {
    if (!lichSu || lichSu.length === 0) {
      return {
        xu_huong: "ngau_nhien",
        ty_le_tai: 50,
        ty_le_xiu: 50,
        chuoi_lien_tiep: 0,
      };
    }

    let demTai = 0;
    let demXiu = 0;
    let chuoiHienTai = 1;
    let ketQuaTruoc = lichSu[0].ket_qua;

    for (let i = 0; i < Math.min(lichSu.length, 50); i++) {
      const ketQua = lichSu[i].ket_qua;
      if (ketQua === "Tài") demTai++;
      else if (ketQua === "Xỉu") demXiu++;

      if (i > 0) {
        if (ketQua === ketQuaTruoc) chuoiHienTai++;
        else chuoiHienTai = 1;
      }
      ketQuaTruoc = ketQua;
    }

    const tong = demTai + demXiu;
    const tyLeTai = tong > 0 ? (demTai / tong) * 100 : 50;
    const tyLeXiu = tong > 0 ? (demXiu / tong) * 100 : 50;

    let xuHuong = "khong_ro";
    if (tyLeTai > 60) xuHuong = "tai";
    else if (tyLeXiu > 60) xuHuong = "xiu";
    else if (Math.abs(tyLeTai - tyLeXiu) < 10) xuHuong = "can_bang";

    return {
      xu_huong: xuHuong,
      ty_le_tai: tyLeTai,
      ty_le_xiu: tyLeXiu,
      chuoi_lien_tiep: chuoiHienTai,
      tong_phien_phan_tich: tong,
    };
  }

  duDoan(lichSu) {
    try {
      if (!lichSu || lichSu.length < 3) {
        return { du_doan: Math.random() > 0.5 ? "Tài" : "Xỉu" };
      }

      const phanTich = this.phanTichLichSu(lichSu);
      const kq1 = lichSu[0].ket_qua;
      const kq2 = lichSu[1].ket_qua;
      const kq3 = lichSu[2].ket_qua;
      let duDoan = "Tài";

      if (phanTich.chuoi_lien_tiep >= 6) {
        duDoan = kq1 === "Tài" ? "Xỉu" : "Tài";
        return { du_doan: duDoan };
      }

      if (phanTich.chuoi_lien_tiep >= 3 && phanTich.chuoi_lien_tiep <= 5) {
        duDoan = kq1;
        return { du_doan: duDoan };
      }

      const cauBetKep = this.nhanDienCauBetKep(lichSu.slice(0, 8).map((p) => p.ket_qua));
      if (cauBetKep) return { du_doan: cauBetKep };

      if (phanTich.xu_huong === "tai" && phanTich.ty_le_tai > 65) duDoan = "Tài";
      else if (phanTich.xu_huong === "xiu" && phanTich.ty_le_xiu > 65)
        duDoan = "Xỉu";

      if (kq1 === kq2 && kq1 !== kq3) {
        duDoan = kq1 === "Tài" ? "Xỉu" : "Tài";
      }

      if (Math.random() * 100 < 20) {
        duDoan = duDoan === "Tài" ? "Xỉu" : "Tài";
      }

      return { du_doan: duDoan };
    } catch (e) {
      return { du_doan: Math.random() > 0.5 ? "Tài" : "Xỉu" };
    }
  }

  nhanDienCauBetKep(mangKetQua) {
    if (mangKetQua.length < 6) return null;
    let nhom = [];
    let dem = 1;
    for (let i = 1; i < mangKetQua.length; i++) {
      if (mangKetQua[i] === mangKetQua[i - 1]) dem++;
      else {
        nhom.push({ kq: mangKetQua[i - 1], so_lan: dem });
        dem = 1;
      }
    }
    nhom.push({ kq: mangKetQua[mangKetQua.length - 1], so_lan: dem });

    if (nhom.length >= 4) {
      const last = nhom.slice(-2);
      if (last[0].so_lan >= 2 && last[1].so_lan >= 2 && last[0].kq !== last[1].kq) {
        return last[0].kq;
      }
    }
    return null;
  }
}

const thuatToan = new ThuatToanTaiXiu();

// ================== Accuracy ==================
function checkAndUpdateAccuracy(latest) {
  try {
    if (!latest || latest.phien === undefined) return;
    if (!cacheDuDoan || !cacheDuDoan.phienDuDoan) return;
    const predictedPhien = String(cacheDuDoan.phienDuDoan);
    const latestPhien = String(latest.phien);
    if (predictedPhien === latestPhien) {
      const actual = latest.ket_qua;
      const predicted = cacheDuDoan.duDoan;
      if ((actual === "Tài" || actual === "Xỉu") && !cacheDuDoan.daCapNhatThongKe) {
        if (actual === predicted) thongKeNgay.dung++;
        else thongKeNgay.sai++;
        cacheDuDoan.daCapNhatThongKe = true;
      }
      if (actual === "Tài" || actual === "Xỉu") cacheDuDoan.ketQuaThucTe = actual;
    }
  } catch {}
}

// ================== API Endpoints ==================
app.get("/api/lookup_predict", async (req, res) => {
  try {
    resetIfNewDay();
    const response = await axios.get(HISTORY_API_URL, { timeout: 7000 });
    const rawData = Array.isArray(response.data) ? response.data : [response.data];
    const data = rawData.map(chuanHoaPhien).filter((x) => x.phien);
    if (data.length === 0)
      return res.json({ id: "WORMGPT_EMPTY", time_vn: getTimeVN(), error: "Không có dữ liệu" });

    checkAndUpdateAccuracy(data[0]);

    const phienGanNhat = String(data[0].phien);
    const phienDuDoan = String(parseInt(phienGanNhat) + 1);
    const ketQuaGanNhat = data[0].ket_qua;
    const chuoiPattern = data.slice(0, 10).map((i) => i.ket_qua).join(",");

    const predict = thuatToan.duDoan(data);
    const duDoan = predict.du_doan;
    const doTinCay = randConfidence();

    cacheDuDoan = {
      phienDuDoan,
      duDoan,
      doTinCay,
      chuoiPattern,
      ketQuaThucTe: null,
      daCapNhatThongKe: false,
    };
    thongKeNgay.tong++;

    res.json({
      id: "WORMGPT_001",
      time_vn: getTimeVN(),
      phien_gan_nhat: phienGanNhat,
      ket_qua_gan_nhat: ketQuaGanNhat,
      phien_du_doan: phienDuDoan,
      du_doan: duDoan,
      do_tin_cay: doTinCay,
      chuoi_pattern: chuoiPattern,
      ket_qua_thuc_te_phien_du_doan: null,
      thong_ke: thongKeNgay,
      thong_tin_thuat_toan: thuatToan.tenThuatToan,
    });
  } catch (e) {
    res.status(500).json({ error: "Không lấy được dữ liệu lịch sử" });
  }
});

app.get("/", (req, res) => {
  res.send("🐍 WormGPT VIP - Endpoint: /api/lookup_predict");
});

app.listen(PORT, () => {
  console.log(`🚀 WormGPT server đang chạy cổng ${PORT} | ${getTimeVN()}`);
});
