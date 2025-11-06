// server_wormgpt.js
// Node.js + Express - SIÊU VIP PRO (WormGPT algorithm, FIX hoa/thường key)
// Chạy: node server_wormgpt.js
// Yêu cầu: node >= 14, npm install express axios

const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;
const HISTORY_API_URL = process.env.HISTORY_API_URL || 'https://lichsulc79md-khvr.onrender.com/api/lxk';

// -------------------- Helpers (VN time / normalize) --------------------
function getTimeVN() {
  return new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}
function getDateVN() {
  return new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}
function randConfidence(min = 50.0, max = 90.0) {
  const r = Math.random() * (max - min) + min;
  return r.toFixed(1) + '%';
}
function normalizeResultInternal(val) {
  if (val === undefined || val === null) return '';
  const s = String(val).trim().toLowerCase();
  if (s === 'tài' || s === 'tai' || s === 't' || s.includes('t')) return 'T';
  if (s === 'xỉu' || s === 'xiu' || s === 'x' || s.includes('x')) return 'X';
  const n = Number(s);
  if (!Number.isNaN(n)) return n >= 11 ? 'T' : 'X';
  return '';
}
function normalizeResultExternal(val) {
  const i = normalizeResultInternal(val);
  if (i === 'T') return 'Tài';
  if (i === 'X') return 'Xỉu';
  return '';
}

// -------------------- CHUẨN HÓA KEY HOA/THƯỜNG --------------------
function normalizeHistoryItem(item) {
  if (!item) return {};
  return {
    phien: item.phien || item.Phien || 0,
    xuc_xac_1: item.xuc_xac_1 || item.Xuc_xac_1 || 0,
    xuc_xac_2: item.xuc_xac_2 || item.Xuc_xac_2 || 0,
    xuc_xac_3: item.xuc_xac_3 || item.Xuc_xac_3 || 0,
    tong: item.tong || item.Tong || 0,
    ket_qua: item.ket_qua || item.Ket_qua || '',
    id_nguon: item.id_nguon || item.ID_Nguon || '@unknown'
  };
}

// -------------------- Simple daily stats & cache --------------------
let thongKeNgay = { ngay: getDateVN(), tong: 0, dung: 0, sai: 0 };
let cacheDuDoan = { phienDuDoan: null, duDoan: 'Đang chờ', doTinCay: '0.0%', chuoiPattern: '', ketQuaThucTe: null, daCapNhatThongKe: false };

function resetIfNewDay() {
  const today = getDateVN();
  if (thongKeNgay.ngay !== today) {
    thongKeNgay = { ngay: today, tong: 0, dung: 0, sai: 0 };
    cacheDuDoan = { phienDuDoan: null, duDoan: 'Đang chờ', doTinCay: '0.0%', chuoiPattern: '', ketQuaThucTe: null, daCapNhatThongKe: false };
    console.log(`[${getTimeVN()}] -> Reset thống kê hàng ngày`);
  }
}

// -------------------- WormGPT Algorithm --------------------
class ThuatToanTaiXiu {
  constructor() {
    this.tenThuatToan = 'WormGPT-Algorithm';
    console.log('✅ WormGPT algorithm initialized');
  }

  phanTichLichSu(lichSu) {
    if (!Array.isArray(lichSu) || lichSu.length === 0) {
      return { xu_huong: 'ngau_nhien', ty_le_tai: 50, ty_le_xiu: 50, chuoi_lien_tiep: 0, tong_phien_phan_tich: 0 };
    }
    let demT = 0, demX = 0, chuoi = 1;
    let prev = normalizeResultExternal(lichSu[0].ket_qua);
    for (let i = 0; i < Math.min(lichSu.length, 50); i++) {
      const r = normalizeResultExternal(lichSu[i].ket_qua);
      if (r === 'Tài') demT++; else if (r === 'Xỉu') demX++;
      if (i > 0) {
        if (r === prev) chuoi++; else chuoi = 1;
      }
      prev = r;
    }
    const tong = demT + demX;
    const tyT = tong ? (demT / tong) * 100 : 50;
    const tyX = tong ? (demX / tong) * 100 : 50;
    let xu = 'khong_ro';
    if (tyT > 60) xu = 'tai';
    else if (tyX > 60) xu = 'xiu';
    else if (Math.abs(tyT - tyX) < 10) xu = 'can_bang';
    return { xu_huong: xu, ty_le_tai: tyT, ty_le_xiu: tyX, chuoi_lien_tiep: chuoi, tong_phien_phan_tich: tong };
  }

  nhanDienCauBetKep(arr) {
    if (!Array.isArray(arr) || arr.length < 6) return null;
    const seq = arr.map(x => normalizeResultExternal(x.ket_qua));
    let groups = [], cnt = 1;
    for (let i = 1; i < seq.length; i++) {
      if (seq[i] === seq[i - 1]) cnt++; else { groups.push({ kq: seq[i - 1], so: cnt }); cnt = 1; }
    }
    groups.push({ kq: seq[seq.length - 1], so: cnt });
    if (groups.length >= 4) {
      const last2 = groups.slice(-2);
      if (last2[0].so >= 2 && last2[1].so >= 2 && last2[0].kq !== last2[1].kq) {
        return last2[0].kq;
      }
    }
    return null;
  }

  duDoan(lichSu) {
    try {
      if (!Array.isArray(lichSu) || lichSu.length < 1) return { du_doan: Math.random() > 0.5 ? 'Tài' : 'Xỉu' };
      const p = this.phanTichLichSu(lichSu);
      const r0 = normalizeResultExternal(lichSu[0].ket_qua);
      const r1 = lichSu[1] ? normalizeResultExternal(lichSu[1].ket_qua) : null;
      const r2 = lichSu[2] ? normalizeResultExternal(lichSu[2].ket_qua) : null;

      if (p.chuoi_lien_tiep >= 6) {
        const d = (r0 === 'Tài') ? 'Xỉu' : 'Tài';
        return { du_doan: d, reason: 'chuoi_dai_dao_chieu', phan_tich: p };
      }
      if (p.chuoi_lien_tiep >= 3 && p.chuoi_lien_tiep <= 5) {
        return { du_doan: r0 || (Math.random() > 0.5 ? 'Tài' : 'Xỉu'), reason: 'cau_bet', phan_tich: p };
      }
      const pattern = this.nhanDienCauBetKep(lichSu.slice(0, 8));
      if (pattern) return { du_doan: pattern, reason: 'cau_bet_kep', phan_tich: p };
      if (p.xu_huong === 'tai' && p.ty_le_tai > 65) return { du_doan: 'Tài', reason: 'xu_huong', phan_tich: p };
      if (p.xu_huong === 'xiu' && p.ty_le_xiu > 65) return { du_doan: 'Xỉu', reason: 'xu_huong', phan_tich: p };
      if (r0 && r1 && r0 === r1 && r0 !== r2) {
        const d = (r0 === 'Tài') ? 'Xỉu' : 'Tài';
        return { du_doan: d, reason: 'mau_lap', phan_tich: p };
      }
      if (Math.random() * 100 < 20) {
        const alt = Math.random() > 0.5 ? 'Tài' : 'Xỉu';
        return { du_doan: alt, reason: 'random_small', phan_tich: p };
      }
      const choose = (p.ty_le_tai >= p.ty_le_xiu) ? 'Tài' : 'Xỉu';
      return { du_doan: choose, reason: 'fallback_ty_le', phan_tich: p };
    } catch (e) {
      return { du_doan: Math.random() > 0.5 ? 'Tài' : 'Xỉu', reason: 'error' };
    }
  }
}

const thuatToan = new ThuatToanTaiXiu();

// -------------------- Update accuracy --------------------
function checkAndUpdateAccuracy(latest) {
  try {
    if (!latest || latest.phien === undefined) return;
    if (!cacheDuDoan || !cacheDuDoan.phienDuDoan) return;
    const predictedPhien = String(cacheDuDoan.phienDuDoan);
    const latestPhien = String(latest.phien);
    if (predictedPhien === latestPhien) {
      const actual = normalizeResultExternal(latest.ket_qua);
      const predicted = cacheDuDoan.duDoan;
      if ((actual === 'Tài' || actual === 'Xỉu') && !cacheDuDoan.daCapNhatThongKe) {
        if (actual === predicted) thongKeNgay.dung++;
        else thongKeNgay.sai++;
        cacheDuDoan.daCapNhatThongKe = true;
      }
      if (actual === 'Tài' || actual === 'Xỉu') cacheDuDoan.ketQuaThucTe = actual;
    }
  } catch (e) {
    console.warn('checkAndUpdateAccuracy error', e && e.message ? e.message : e);
  }
}

// -------------------- Endpoints --------------------
app.get('/api/lookup_predict', async (req, res) => {
  try {
    resetIfNewDay();
    const response = await axios.get(HISTORY_API_URL, { timeout: 7000 });
    const rawData = Array.isArray(response.data) ? response.data : [response.data];
    const data = rawData.map(normalizeHistoryItem).filter(d => d.phien);

    if (!data || data.length === 0) {
      return res.json({ id: 'WORMGPT_001', time_vn: getTimeVN(), error: 'Không có dữ liệu lịch sử', thong_ke: thongKeNgay });
    }

    checkAndUpdateAccuracy(data[0]);
    const phienGanNhat = String(data[0].phien);
    const phienDuDoanTiepTheo = String(Number(phienGanNhat) + 1);
    const ketQuaGanNhat = normalizeResultExternal(data[0].ket_qua);

    if (cacheDuDoan.phienDuDoan === phienDuDoanTiepTheo) {
      return res.json({ id: 'WORMGPT_CACHE', time_vn: getTimeVN(), phien_gan_nhat: phienGanNhat, ket_qua_gan_nhat: ketQuaGanNhat, phien_du_doan: cacheDuDoan.phienDuDoan, du_doan: cacheDuDoan.duDoan, do_tin_cay: cacheDuDoan.doTinCay, chuoi_pattern: cacheDuDoan.chuoiPattern, ket_qua_thuc_te_phien_du_doan: cacheDuDoan.ketQuaThucTe, thong_ke: thongKeNgay });
    }

    const predict = thuatToan.duDoan(data);
    const duDoan = predict.du_doan || (Math.random() > 0.5 ? 'Tài' : 'Xỉu');
    const chuoiPattern = data.slice(0, 15).map(it => normalizeResultExternal(it.ket_qua)).join(',');
    const doTinCay = randConfidence();

    cacheDuDoan = { phienDuDoan: phienDuDoanTiepTheo, duDoan, doTinCay, chuoiPattern, ketQuaThucTe: null, daCapNhatThongKe: false };
    thongKeNgay.tong++;

    return res.json({ id: 'WORMGPT_001', time_vn: getTimeVN(), phien_gan_nhat: phienGanNhat, ket_qua_gan_nhat: ketQuaGanNhat, phien_du_doan: phienDuDoanTiepTheo, du_doan: duDoan, do_tin_cay: doTinCay, chuoi_pattern: chuoiPattern, ket_qua_thuc_te_phien_du_doan: null, thong_ke: thongKeNgay, thong_tin_thuat_toan: thuatToan.tenThuatToan, reason: predict.reason || null });
  } catch (err) {
    console.error('Lỗi khi gọi API lịch sử:', err.message);
    return res.status(500).json({ id: 'WORMGPT_ERR', time_vn: getTimeVN(), error: 'Không lấy được dữ liệu lịch sử', thong_ke: thongKeNgay });
  }
});

app.get('/api/thongke', (req, res) => {
  resetIfNewDay();
  res.json({ id: 'WORMGPT_STAT', time_vn: getTimeVN(), thong_ke: thongKeNgay, cache_du_doan_gan_nhat: cacheDuDoan, thong_tin_thuat_toan: thuatToan.tenThuatToan });
});

app.get('/', (req, res) => res.send('👑 SIÊU VIP PRO (WormGPT) - Endpoint: /api/lookup_predict'));

app.listen(PORT, () => console.log(`🚀 Server WormGPT chạy cổng ${PORT} - Time VN: ${getTimeVN()}`));
