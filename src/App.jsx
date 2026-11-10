import React, { useState, useEffect, useRef } from 'react';
import { 
  Scissors, Users, DollarSign, Calendar, FileText, Settings, 
  LogOut, Plus, Minus, Trash2, Edit2, CheckCircle, Share2, Upload, 
  Shield, UserCheck, ShieldAlert, ShoppingBag, ArrowDownRight, Printer, RefreshCw, Wallet, Download, AlertCircle, FileSpreadsheet, TrendingUp, CreditCard, Banknote, ChevronDown, ChevronUp, Receipt, HelpCircle, Phone, Lock, Eye, EyeOff, Calculator
} from 'lucide-react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';

export default function App() {
  const [role, setRole] = useState(null); 
  const [activeTab, setActiveTab] = useState('pos'); // owner bottom nav: 'pos' (Hari Ini), 'kas' (Kas), 'gaji' (Gaji), 'recap' (Rekap), 'setting' (Setting)
  const [ownerPinInput, setOwnerPinInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // PIN owner TIDAK disimpan di kode/HP: dicek & diganti di server (Supabase) lewat fungsi verify_owner_pin / change_owner_pin.
  const [verifiedPin, setVerifiedPin] = useState('');
  const [pinChecking, setPinChecking] = useState(false);
  const logo = '/logo_baru.jpg';

  const [services, setServices] = useState([]);
  const [employees, setEmployees] = useState([
    { name: 'allfin', ratio: '100/0', baseSalary: 0, active: true, ownerRole: true },
    { name: 'molan', ratio: '60/40', baseSalary: 0, active: true, ownerRole: true }
  ]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [savings, setSavings] = useState([]);

  // Pengaman klik ganda: selama satu simpanan masih dikirim, tekanan berikutnya diabaikan
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const guarded = (fn) => async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try { await fn(e); } finally { busyRef.current = false; setBusy(false); }
  };

  // Kalkulator (tombol melayang, tersedia untuk owner & kapster)
  const [showCalc, setShowCalc] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPrev, setCalcPrev] = useState(null);
  const [calcOp, setCalcOp] = useState(null);
  const [calcFresh, setCalcFresh] = useState(true);

  // Setting sub-view inside 'setting' tab
  const [settingView, setSettingView] = useState('main'); // 'main', 'kelola_barberman', 'layanan', 'whatsapp', 'keamanan'

  // Barberman visibility toggle setting
  const [canViewOtherEarnings, setCanViewOtherEarnings] = useState(false);
  const [waNumber, setWaNumber] = useState('089604194991');
  const [waInput, setWaInput] = useState('089604194991');

  // Dates
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr); 
  const [transactionDate, setTransactionDate] = useState(todayStr); 

  // Excel filter state
  const [exportRange, setExportRange] = useState('harian');
  const [kasFilter, setKasFilter] = useState('harian');
  const [posFilter, setPosFilter] = useState('harian');
  const [gajiFilter, setGajiFilter] = useState('harian'); 

  // POS Form state (Posbar Style)
  const [selectedEmployee, setSelectedEmployee] = useState('allfin');
  const [serviceQty, setServiceQty] = useState({}); // { [id layanan]: jumlah }
  const [useKeramas, setUseKeramas] = useState(false);
  const [useKumis, setUseKumis] = useState(false);
  const [hairtonixQty, setHairtonixQty] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [customerName, setCustomerName] = useState('');

  // Expenses form state
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseSpender, setExpenseSpender] = useState('owner'); 
  const [expensePayment, setExpensePayment] = useState('Tunai'); // 'Tunai' | 'QRIS'
  const [recapFilter, setRecapFilter] = useState('harian');
  const [showExpensesSection, setShowExpensesSection] = useState(true);

  // Kapster sub-tabs ('transaksi', 'riwayat', 'pengeluaran')
  const [employeeSubTab, setEmployeeSubTab] = useState('transaksi');

  // Salary Slip Modal state for Owner
  const [slipModalEmp, setSlipModalEmp] = useState(null);
  const [slipBon, setSlipBon] = useState('');
  const [slipMeal, setSlipMeal] = useState('');

  // Add barber modal state
  const [showAddBarberModal, setShowAddBarberModal] = useState(false);
  const [newBarberName, setNewBarberName] = useState('');
  const [newBarberRatio, setNewBarberRatio] = useState('60/40');

  useEffect(() => {
    fetchData();
    fetchSettings();
    setupRealtimeSubscriptions();
    // pengaturan disegarkan tiap 1 menit supaya perubahan dari HP owner masuk ke HP kapster
    const timer = setInterval(fetchSettings, 60000);
    return () => clearInterval(timer);
  }, []);

  // Pengaturan disimpan di Supabase: daftar kapster + skema bagi hasil di tabel `employees`,
  // toggle "lihat pendapatan" dan nomor WhatsApp di tabel `settings`. PIN ada di server (hash), tidak dibaca aplikasi.
  const fetchSettings = async () => {
    try {
      const [empRes, setRes] = await Promise.all([
        supabase.from('employees').select('name,ratio,base_salary,active').order('id', { ascending: true }),
        supabase.from('settings').select('key,value')
      ]);
      if (empRes.data && empRes.data.length > 0) {
        setEmployees(empRes.data.map(r => ({
          name: String(r.name).toLowerCase(),
          ratio: r.ratio || '60/40',
          baseSalary: Number(r.base_salary) || 0,
          active: r.active !== false,
          ownerRole: true
        })));
      }
      if (setRes.data) {
        setRes.data.forEach(row => {
          if (row.key === 'can_view_other_earnings') setCanViewOtherEarnings(String(row.value) === 'true');
          if (row.key === 'wa_number' && row.value) setWaNumber(String(row.value));
        });
      }
    } catch (e) {
      console.error('Error fetching settings:', e);
    }
  };

  // Simpan 1 pengaturan ke server. Server memeriksa PIN owner sebelum menerima perubahan.
  const saveSetting = async (key, value) => {
    try {
      const { data, error } = key === 'employees'
        ? await supabase.rpc('save_employees', {
            p_pin: verifiedPin,
            p_list: value.map(e => ({ name: e.name, ratio: e.ratio, baseSalary: e.baseSalary || 0, active: e.active !== false }))
          })
        : await supabase.rpc('save_setting', { p_pin: verifiedPin, p_key: key, p_value: value });
      if (error) { alert('Gagal menyimpan pengaturan ke server: ' + error.message); return false; }
      if (data !== true) { alert('Pengaturan ditolak server (PIN salah atau terkunci sementara). Keluar lalu masuk Owner lagi.'); return false; }
      return true;
    } catch (e) {
      alert('Gagal menyimpan pengaturan: tidak bisa terhubung ke server.');
      return false;
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [svcRes, txRes, expRes, savRes] = await Promise.all([
        supabase.from('services').select('*').order('created_at', { ascending: true }),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('savings').select('*').order('created_at', { ascending: false })
      ]);

      if (svcRes.data) setServices(svcRes.data);
      if (txRes.data) setTransactions(txRes.data);
      if (expRes.data) setExpenses(expRes.data);
      if (savRes.data) setSavings(savRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const servicesSub = supabase.channel('public:services')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, payload => {
        if (payload.eventType === 'INSERT') setServices(prev => [...prev, payload.new]);
        if (payload.eventType === 'DELETE') setServices(prev => prev.filter(s => s.id !== payload.old.id));
      }).subscribe();

    const txSub = supabase.channel('public:transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, payload => {
        if (payload.eventType === 'INSERT') setTransactions(prev => [payload.new, ...prev]);
        if (payload.eventType === 'DELETE') setTransactions(prev => prev.filter(t => t.id !== payload.old.id));
      }).subscribe();

    const expSub = supabase.channel('public:expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, payload => {
        if (payload.eventType === 'INSERT') setExpenses(prev => [payload.new, ...prev]);
        if (payload.eventType === 'DELETE') setExpenses(prev => prev.filter(e => e.id !== payload.old.id));
      }).subscribe();

    const savSub = supabase.channel('public:savings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings' }, payload => {
        if (payload.eventType === 'INSERT') setSavings(prev => [payload.new, ...prev]);
        if (payload.eventType === 'DELETE') setSavings(prev => prev.filter(s => s.id !== payload.old.id));
      }).subscribe();

    return () => {
      supabase.removeChannel(servicesSub);
      supabase.removeChannel(txSub);
      supabase.removeChannel(expSub);
      supabase.removeChannel(savSub);
    };
  };

  const selectedServiceList = services.filter(sv => (serviceQty[sv.id] || 0) > 0);
  const basePrice = selectedServiceList.reduce((sum, sv) => sum + sv.price * serviceQty[sv.id], 0);
  const setQty = (id, delta) => setServiceQty(q => ({ ...q, [id]: Math.max(0, (q[id] || 0) + delta) }));
  const keramasPrice = useKeramas ? 5000 : 0;
  const kumisPrice = useKumis ? 5000 : 0;
  const hairtonixPrice = hairtonixQty * 25000;
  const calculatedTotalAmount = basePrice + keramasPrice + kumisPrice + hairtonixPrice;


  const playNotif = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch(e) {
      console.log("Audio synth error", e);
    }
  };


  const handleTransactionSubmitRaw = async (e) => {
    e.preventDefault();
    playNotif();
    if (!selectedEmployee || selectedServiceList.length === 0) {
      alert('Mohon pilih kapster dan tambahkan minimal 1 layanan (tombol +) terlebih dahulu!');
      return;
    }

    let addonsList = [];
    if (useKeramas) addonsList.push('Keramas');
    if (useKumis) addonsList.push('Kumis & Jenggot');
    if (hairtonixQty > 0) addonsList.push(`Hairtonix (${hairtonixQty}x)`);
    const addonsTotal = keramasPrice + kumisPrice + hairtonixPrice;

    const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // 1 baris transaksi = 1 kepala. Tambahan (keramas/kumis/hairtonix) ikut di baris pertama.
    const newTxs = [];
    selectedServiceList.forEach(sv => {
      for (let i = 0; i < serviceQty[sv.id]; i++) {
        newTxs.push({
          date: transactionDate,
          employee: selectedEmployee,
          customer: customerName || 'Walk-in',
          service: sv.name,
          amount: sv.price,
          payment_method: paymentMethod,
          transaction_time: currentTime,
        });
      }
    });
    if (addonsList.length > 0) {
      newTxs[0].service += ` + ${addonsList.join(', ')}`;
      newTxs[0].amount += addonsTotal;
    } else if (addonsTotal > 0) {
      newTxs[0].amount += addonsTotal;
    }

    const { error } = await supabase.from('transactions').insert(newTxs);
    
    if (error) {
        alert('Gagal menyimpan transaksi: ' + error.message);
    } else {
        setServiceQty({});
        const { data: txFresh } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
        if (txFresh) setTransactions(txFresh);
        setUseKeramas(false);
        setUseKumis(false);
        setHairtonixQty(0);
        setCustomerName('');
        alert(`Transaksi berhasil disimpan pada pukul ${currentTime}!${newTxs.length > 1 ? ' (' + newTxs.length + ' kepala)' : ''}`);
    }
  };

  const handleDeleteTransaction = async (tx) => {
    if (role === 'owner') {
      const confirmDelete = window.confirm(`Owner: Yakin ingin menghapus transaksi atas nama "${tx.customer}" (${tx.service} - Rp ${tx.amount.toLocaleString()})?`);
      if (!confirmDelete) return;

      const { error } = await supabase.from('transactions').delete().eq('id', tx.id);
      if (error) alert('Gagal menghapus: ' + error.message);
      else alert('Transaksi berhasil dihapus oleh Owner.');
    } else if (role === 'karyawan') {
      const reason = prompt('Masukkan ALASAN mengapa transaksi ini harus dihapus (wajib diisi):');
      if (reason === null) return;
      if (!reason.trim()) {
        alert('Penghapusan dibatalkan. Alasan wajib diisi!');
        return;
      }

      const { error } = await supabase.from('transactions').delete().eq('id', tx.id);
      if (error) alert('Gagal menghapus: ' + error.message);
      else alert(`Transaksi berhasil dihapus.\nAlasan: "${reason}"`);
    }
  };

  const handleAddExpenseRaw = async (e) => {
    e.preventDefault();
    if (!expenseDesc || !expenseAmount) return;
    
    const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const formattedDesc = `[${expenseSpender.toUpperCase()}${expensePayment === 'QRIS' ? '|QRIS' : ''}] ${expenseDesc}`;

    const newExp = {
      date: transactionDate,
      description: formattedDesc,
      amount: parseFloat(expenseAmount),
      expense_time: currentTime,
    };
    
    const { error } = await supabase.from('expenses').insert([newExp]);
    if (error) {
        alert('Gagal menyimpan pengeluaran: ' + error.message);
    } else {
        setExpenseDesc('');
        setExpenseAmount('');
        alert(`Pengeluaran berhasil dicatat pukul ${currentTime}!`);
    }
  };

  const handleDeleteExpense = async (exp) => {
    const confirmDel = window.confirm(`Yakin ingin menghapus pengeluaran "${expText(exp)}" (Rp ${exp.amount.toLocaleString()})?`);
    if (!confirmDel) return;

    const { error } = await supabase.from('expenses').delete().eq('id', exp.id);
    if (error) alert('Gagal menghapus pengeluaran: ' + error.message);
    else alert('Pengeluaran berhasil dihapus.');
  };

  const refreshSavings = async () => {
    const { data } = await supabase.from('savings').select('*').order('created_at', { ascending: false });
    if (data) setSavings(data);
  };

  const handleAddSavingRaw = async (e) => {
    e.preventDefault();
    const formEl = e.target;
    const amount = parseFloat(formEl.savingAmount.value);
    if (!amount) return;
    
    const newSav = { date: transactionDate, amount: amount };
    const { error } = await supabase.from('savings').insert([newSav]);
    if (error) alert('Gagal menyimpan tabungan: ' + error.message);
    else {
      formEl.reset();
      await refreshSavings();
      alert('Detail menabung berhasil ditambahkan!');
    }
  };

  const handleDeleteSaving = async (sv) => {
    if (!window.confirm(`Hapus setoran tabungan Rp ${sv.amount.toLocaleString()} (${sv.date})?`)) return;
    const { error } = await supabase.from('savings').delete().eq('id', sv.id);
    if (error) alert('Gagal menghapus: ' + error.message);
    else await refreshSavings();
  };

  const handleTransactionSubmit = guarded(handleTransactionSubmitRaw);
  const handleAddExpense = guarded(handleAddExpenseRaw);
  const handleAddSaving = guarded(handleAddSavingRaw);

  const handleAddService = async (e) => {
    e.preventDefault();
    const name = e.target.serviceName.value;
    const price = parseFloat(e.target.servicePrice.value);
    if (!name || !price) return;
    
    const { error } = await supabase.from('services').insert([{ name, price }]);
    if (error) alert('Gagal menambah layanan: ' + error.message);
    else {
      e.target.reset();
      alert('Layanan berhasil ditambahkan!');
    }
  };
  
  const handleDeleteService = async (id) => {
      const confirmDel = window.confirm('Yakin ingin menghapus layanan ini?');
      if (!confirmDel) return;
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) alert('Gagal menghapus layanan: ' + error.message);
  }

  const handleAddBarber = async (e) => {
    e.preventDefault();
    const name = newBarberName.trim().toLowerCase();
    if (!name) return;
    if (employees.some(emp => emp.name === name)) { alert('Nama kapster sudah ada!'); return; }
    const updated = [...employees, { name, ratio: newBarberRatio, active: true, ownerRole: false }];
    if (!(await saveSetting('employees', updated))) return;
    setEmployees(updated);
    setNewBarberName('');
    setShowAddBarberModal(false);
    alert('Kapster berhasil ditambahkan!');
  };

  const handleEditRatio = async (index) => {
    const emp = employees[index];
    const newRatio = window.prompt(`Edit skema bagi hasil untuk ${emp.name.toUpperCase()} (Contoh: 60/40, 70/30, 80/20, 100/0):`, emp.ratio);
    if (newRatio && newRatio.trim()) {
      const updated = employees.map((e, i) => (i === index ? { ...e, ratio: newRatio.trim() } : e));
      if (!(await saveSetting('employees', updated))) return;
      setEmployees(updated);
      alert(`Skema ${emp.name.toUpperCase()} berhasil diubah ke ${newRatio.trim()}!`);
    }
  };

  const toggleBarberActive = async (index) => {
    const updated = employees.map((e, i) => (i === index ? { ...e, active: !e.active } : e));
    if (!(await saveSetting('employees', updated))) return;
    setEmployees(updated);
  };

  const deleteBarber = async (index) => {
    if (employees.length <= 1) {
      alert('Minimal harus ada 1 kapster!');
      return;
    }
    const confirmDel = window.confirm(`Yakin ingin menghapus kapster "${employees[index].name}"?`);
    if (!confirmDel) return;
    const updated = employees.filter((_, i) => i !== index);
    if (!(await saveSetting('employees', updated))) return;
    setEmployees(updated);
  };

  const toggleCanViewOtherEarnings = async () => {
    const next = !canViewOtherEarnings;
    if (!(await saveSetting('can_view_other_earnings', next))) return;
    setCanViewOtherEarnings(next);
  };

  const handleSaveWaNumber = async () => {
    const val = waInput.trim();
    if (!/^[0-9+]{8,16}$/.test(val)) { alert('Nomor WhatsApp tidak valid (angka saja, 8-16 digit).'); return; }
    if (!(await saveSetting('wa_number', val))) return;
    setWaNumber(val);
    alert('Nomor WhatsApp berhasil disimpan!');
  };

  const handleChangePin = async () => {
    const input = document.getElementById('newPinInput');
    const val = input ? input.value : '';
    if (!/^[0-9]{4,6}$/.test(val)) {
      alert('PIN harus 4-6 digit angka!');
      return;
    }
    try {
      const { data, error } = await supabase.rpc('change_owner_pin', { p_old: verifiedPin, p_new: val });
      if (error || data !== true) {
        alert('PIN gagal diperbarui' + (error ? ': ' + error.message : ' (ditolak server). Keluar lalu masuk Owner lagi.'));
        return;
      }
      setVerifiedPin(val);
      alert('PIN Owner berhasil diperbarui dan tersimpan di server! Gunakan PIN baru ini untuk login berikutnya.');
      setSettingView('main');
    } catch (e) {
      alert('PIN gagal diperbarui: tidak bisa terhubung ke server.');
    }
  };

  const handleOwnerLogin = async (e) => {
    e.preventDefault();
    if (pinChecking) return;
    setPinChecking(true);
    try {
      const { data, error } = await supabase.rpc('verify_owner_pin', { p_pin: ownerPinInput });
      if (error) {
        alert('Tidak bisa memeriksa PIN: ' + error.message);
      } else if (data === true) {
        setVerifiedPin(ownerPinInput);
        setOwnerPinInput('');
        setRole('owner');
        setActiveTab('pos');
        fetchSettings();
        return;
      } else {
        alert('PIN Salah! (5x salah = terkunci 2 menit)');
        setOwnerPinInput('');
      }
    } catch (err) {
      alert('Tidak bisa terhubung ke server. Cek internet lalu coba lagi.');
    } finally {
      setPinChecking(false);
    }
  };

  const exportToExcel = () => {
    let filteredTx = [...transactions];
    let filteredExp = [...expenses];
    const now = new Date(selectedDate);

    if (exportRange === 'harian') {
      filteredTx = transactions.filter(t => t.date === selectedDate);
      filteredExp = expenses.filter(e => e.date === selectedDate);
    } else if (exportRange === 'mingguan') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 6);
      filteredTx = transactions.filter(t => {
        const d = new Date(t.date);
        return d >= startOfWeek && d <= now;
      });
      filteredExp = expenses.filter(e => {
        const d = new Date(e.date);
        return d >= startOfWeek && d <= now;
      });
    } else if (exportRange === 'bulanan') {
      const year = now.getFullYear();
      const month = now.getMonth();
      filteredTx = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      filteredExp = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
    }

    const totalOmsetVal = filteredTx.reduce((sum, t) => sum + t.amount, 0);
    const totalExpVal = filteredExp.reduce((sum, e) => sum + e.amount, 0);
    const netIncomeVal = totalOmsetVal - totalExpVal;

    // Prepare data with summary rows at the bottom
    const txData = filteredTx.map(t => ({
        "Tanggal": t.date,
        "Jam": t.transaction_time || '-',
        "Kapster": t.employee,
        "Pelanggan": t.customer,
        "Layanan": t.service,
        "Nominal": t.amount,
        "Pembayaran": t.payment_method
    }));
    
    // Add summary rows to Transaction sheet
    txData.push({});
    txData.push({ "Tanggal": "TOTAL OMSET", "Nominal": totalOmsetVal });
    txData.push({ "Tanggal": "TOTAL PENGELUARAN", "Nominal": totalExpVal });
    txData.push({ "Tanggal": "PENDAPATAN BERSIH", "Nominal": netIncomeVal });

    const expData = filteredExp.map(e => ({
        "Tanggal": e.date,
        "Jam": e.expense_time || '-',
        "Keterangan": expText(e),
        "Metode": expMethod(e),
        "Nominal": e.amount
    }));
    expData.push({});
    expData.push({ "Tanggal": "TOTAL PENGELUARAN", "Nominal": totalExpVal });

    const wsTx = XLSX.utils.json_to_sheet(txData);
    const wsExp = XLSX.utils.json_to_sheet(expData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsTx, "Transaksi");
    XLSX.utils.book_append_sheet(wb, wsExp, "Pengeluaran");
    
    XLSX.writeFile(wb, `Laporan_RekapGCBangAll_${exportRange}_${selectedDate}.xlsx`);
  };

  const sendReportWA = () => {
    let filteredTx = [...transactions];
    let filteredExp = [...expenses];
    const now = new Date(selectedDate);

    if (exportRange === 'harian') {
      filteredTx = transactions.filter(t => t.date === selectedDate);
      filteredExp = expenses.filter(e => e.date === selectedDate);
    } else if (exportRange === 'mingguan') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 6);
      filteredTx = transactions.filter(t => {
        const d = new Date(t.date);
        return d >= startOfWeek && d <= now;
      });
      filteredExp = expenses.filter(e => {
        const d = new Date(e.date);
        return d >= startOfWeek && d <= now;
      });
    } else if (exportRange === 'bulanan') {
      const year = now.getFullYear();
      const month = now.getMonth();
      filteredTx = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      filteredExp = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
    }

    const rangeSales = filteredTx.reduce((sum, t) => sum + t.amount, 0);
    const rangeExpense = filteredExp.reduce((sum, e) => sum + e.amount, 0);
    const rangeNet = rangeSales - rangeExpense;

    let message = `*LAPORAN (${exportRange.toUpperCase()}) REKAP GC BANG ALL*%0A`;
    message += `📅 Periode/Tanggal: ${selectedDate}%0A`;
    message += `---------------------------%0A`;
    message += `💰 *TOTAL OMSET:* Rp ${rangeSales.toLocaleString()}%0A`;
    message += `📉 *TOTAL PENGELUARAN:* Rp ${rangeExpense.toLocaleString()}%0A`;
    message += `✅ *PENDAPATAN BERSIH:* Rp ${rangeNet.toLocaleString()}%0A`;
    message += `---------------------------%0A`;
    message += `*Performa Kapster (${exportRange}):*%0A`;
    
    employees.forEach(emp => {
        const empFilteredTx = filteredTx.filter(t => t.employee.toLowerCase() === emp.name.toLowerCase());
        const empTotal = empFilteredTx.reduce((sum, t) => sum + t.amount, 0);
        message += `👤 ${emp.name.toUpperCase()}: ${empFilteredTx.length} kepala / Rp ${empTotal.toLocaleString()}%0A`;
    });
    
    const waUrl = `https://wa.me/?text=${message}`;
    window.open(waUrl, '_blank');
  };

  const sendSalarySlipWA = (empObj, stats, bonVal, mealVal, netSalary) => {
    let message = `*SLIP GAJI & BAGI HASIL KAPSTER (${gajiFilter.toUpperCase()})*%0A`;
    message += `🏪 REKAP GC BANG ALL%0A`;
    message += `📅 Tanggal/Periode: ${selectedDate}%0A`;
    message += `👤 Nama Kapster: ${empObj.name.toUpperCase()} (Skema: ${empObj.ratio})%0A`;
    message += `---------------------------%0A`;
    message += `✂️ Total Kepala: ${stats.count} Kepala%0A`;
    message += `📋 Rincian: ${stats.summary || '-'}%0A`;
    message += `💵 Total Omset: Rp ${stats.total.toLocaleString()}%0A`;
    if (bonVal > 0) message += `📉 Potongan Bon: - Rp ${bonVal.toLocaleString()}%0A`;
    if (mealVal > 0) message += `🍜 Uang Makan: + Rp ${mealVal.toLocaleString()}%0A`;
    message += `---------------------------%0A`;
    message += `💰 *TOTAL GAJI DITERIMA: Rp ${netSalary.toLocaleString()}*%0A`;
    
    const waUrl = `https://wa.me/?text=${message}`;
    window.open(waUrl, '_blank');
  };

  useEffect(() => { if (role !== 'owner') setVerifiedPin(''); }, [role]);

  const activeDateForView = role === 'owner' ? selectedDate : transactionDate;
  const todayTransactions = transactions.filter(t => t.date === activeDateForView);
  const todayExpenses = expenses.filter(e => e.date === activeDateForView);
  const totalSales = todayTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenseAmount = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netIncome = totalSales - totalExpenseAmount;

  const totalTunai = todayTransactions.filter(t => t.payment_method === 'Tunai').reduce((sum, t) => sum + t.amount, 0);
  const totalQris = todayTransactions.filter(t => t.payment_method === 'QRIS').reduce((sum, t) => sum + t.amount, 0);

  const targetTabungan = 10000000;
  const totalTabungan = savings.reduce((sum, s) => sum + s.amount, 0);
  const sisaTabungan = Math.max(targetTabungan - totalTabungan, 0);
  const progressTabungan = Math.min((totalTabungan / targetTabungan) * 100, 100);

  // Target tabungan ruko: Rp 10 juta sampai 28 Februari 2027, TIDAK menabung setiap hari Senin.
  const tabunganDeadline = '2027-02-28';
  const toUTC = (str) => { const [y, m, d] = str.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const countDays = (fromStr, toStr) => {
    let total = 0, mondays = 0;
    for (let t = toUTC(fromStr); t <= toUTC(toStr); t += 86400000) {
      total++;
      if (new Date(t).getUTCDay() === 1) mondays++;
    }
    return { total: Math.max(total, 0), mondays, nonMonday: Math.max(total - mondays, 0) };
  };
  const tabDays = countDays(todayStr, tabunganDeadline); // dihitung mulai hari ini
  const remainingDays = Math.max(tabDays.nonMonday, 1);
  const targetPerDay = Math.ceil(sisaTabungan / remainingDays);
  const targetPerWeek = targetPerDay * 6;
  const tabTotalDays = countDays(todayStr.slice(0, 8) + '01', tabunganDeadline); // sejak awal bulan ini
  const todayIsMonday = new Date(toUTC(todayStr)).getUTCDay() === 1;
  const savedToday = savings.filter(x => x.date === todayStr).reduce((sum, x) => sum + x.amount, 0);

  // ---- Rekap pengeluaran owner vs kapster (dibaca dari awalan [OWNER] / [NAMA] pada keterangan) ----
  const expSpender = (e) => {
    const m = /^\[([^\]|]+)(\|[^\]]*)?\]/.exec(e.description || '');
    return m ? m[1].trim().toUpperCase() : 'OWNER';
  };
  // Metode bayar pengeluaran: awalan [NAMA|QRIS] = QRIS; selain itu (termasuk data lama) = Tunai
  const expMethod = (e) => (/^\[[^\]]*\|QRIS\]/i.test(e.description || '') ? 'QRIS' : 'Tunai');
  const expText = (e) => (e.description || '').replace(/^\[([^\]|]+)\|QRIS\]/i, '[$1]');
  const todayExpTunai = todayExpenses.filter(e => expMethod(e) === 'Tunai').reduce((sum, e) => sum + e.amount, 0);
  const cashInDrawer = totalTunai - todayExpTunai;
  const expInRange = (e, type, refStr) => {
    if (type === 'harian') return e.date === refStr;
    const ref = new Date(refStr), d = new Date(e.date);
    if (type === 'mingguan') { const st = new Date(ref); st.setDate(ref.getDate() - 6); return d >= st && d <= ref; }
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
  };
  const txInRange = (t, type, refStr) => expInRange(t, type, refStr);
  const methodReport = (type, refStr) => {
    const tx = transactions.filter(t => txInRange(t, type, refStr));
    const ex = expenses.filter(e => expInRange(e, type, refStr));
    const sum = (arr) => arr.reduce((a, x) => a + x.amount, 0);
    const inT = sum(tx.filter(t => t.payment_method === 'Tunai')), inQ = sum(tx.filter(t => t.payment_method === 'QRIS'));
    const outT = sum(ex.filter(e => expMethod(e) === 'Tunai')), outQ = sum(ex.filter(e => expMethod(e) === 'QRIS'));
    return { inT, inQ, outT, outQ, netT: inT - outT, netQ: inQ - outQ, net: inT + inQ - outT - outQ };
  };
  const expSplit = (type, refStr) => {
    const list = expenses.filter(e => expInRange(e, type, refStr));
    const owner = list.filter(e => expSpender(e) === 'OWNER').reduce((sm, e) => sm + e.amount, 0);
    const kapster = list.filter(e => expSpender(e) !== 'OWNER').reduce((sm, e) => sm + e.amount, 0);
    return { owner, kapster, total: owner + kapster };
  };

  // ---- Kalkulator ----
  const calcCompute = (a, b, op) => {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? NaN : a / b;
    return b;
  };
  const calcFmt = (n) => (Number.isFinite(n) ? String(parseFloat(n.toFixed(8))) : 'Error');
  // Tampilan: titik pemisah ribuan otomatis, koma untuk desimal (format Indonesia)
  const calcShow = (str) => {
    if (str === 'Error' || str === '' || str == null) return String(str ?? '');
    const s0 = String(str); const neg = s0.startsWith('-'); const body = neg ? s0.slice(1) : s0;
    const [i, d] = body.split('.');
    const ii = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + ii + (d !== undefined ? ',' + d : '');
  };
  const calcPress = (k) => {
    if (/^[0-9.]$/.test(k)) {
      if (calcFresh) { setCalcDisplay(k === '.' ? '0.' : k); setCalcFresh(false); }
      else if (k === '.' && calcDisplay.includes('.')) return;
      else setCalcDisplay(calcDisplay.length < 15 ? calcDisplay + k : calcDisplay);
    } else if (k === 'C') {
      setCalcDisplay('0'); setCalcPrev(null); setCalcOp(null); setCalcFresh(true);
    } else if (k === '⌫') {
      if (!calcFresh) setCalcDisplay(calcDisplay.length > 1 ? calcDisplay.slice(0, -1) : '0');
    } else if (k === '%') {
      const cur = parseFloat(calcDisplay);
      if (!Number.isFinite(cur)) return;
      // Seperti kalkulator HP: 200 + 10% = 220 (10% dari 200); 200 × 10% = 20
      const val = (calcOp === '+' || calcOp === '-') && calcPrev !== null ? (calcPrev * cur) / 100 : cur / 100;
      setCalcDisplay(calcFmt(val)); setCalcFresh(false);
    } else if (k === '=') {
      if (calcOp !== null && calcPrev !== null) {
        setCalcDisplay(calcFmt(calcCompute(calcPrev, parseFloat(calcDisplay), calcOp)));
        setCalcPrev(null); setCalcOp(null); setCalcFresh(true);
      }
    } else {
      const cur = parseFloat(calcDisplay);
      if (calcOp !== null && calcPrev !== null && !calcFresh) {
        const r = calcCompute(calcPrev, cur, calcOp);
        setCalcPrev(r); setCalcDisplay(calcFmt(r));
      } else setCalcPrev(cur);
      setCalcOp(k); setCalcFresh(true);
    }
  };

  const filterTransactionsByRange = (txList = [], dateStr, rangeType) => {
    if (!Array.isArray(txList)) return [];
    const now = new Date(dateStr || new Date());
    if (rangeType === 'harian') {
      return txList.filter(t => t && t.date === dateStr);
    } else if (rangeType === 'mingguan') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 6);
      return txList.filter(t => {
        if (!t || !t.date) return false;
        const d = new Date(t.date);
        return d >= startOfWeek && d <= now;
      });
    } else if (rangeType === 'bulanan') {
      const year = now.getFullYear();
      const month = now.getMonth();
      return txList.filter(t => {
        if (!t || !t.date) return false;
        const d = new Date(t.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
    }
    return txList;
  };

  const getEmployeeStatsForRange = (empName, dateStr, rangeType) => {
    const filteredTx = filterTransactionsByRange(transactions, dateStr, rangeType).filter(t => t && t.employee && t.employee.toLowerCase() === (empName || '').toLowerCase());
    const totalOmset = filteredTx.reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const serviceCounts = {};
    filteredTx.forEach(t => {
      if (t && t.service) {
        const mainSrv = t.service.split('+')[0].trim();
        serviceCounts[mainSrv] = (serviceCounts[mainSrv] || 0) + 1;
      }
    });
    const serviceSummaryStr = Object.entries(serviceCounts).map(([k, v]) => `${k} ${v}`).join(' · ');

    return { count: filteredTx.length, total: totalOmset, summary: serviceSummaryStr };
  };

  const getEmployeeStatsForDate = (empName, dateStr) => {
    const empTx = transactions.filter(t => t.employee.toLowerCase() === empName.toLowerCase() && t.date === dateStr);
    const totalOmset = empTx.reduce((sum, t) => sum + t.amount, 0);
    
    const serviceCounts = {};
    empTx.forEach(t => {
      const mainSrv = t.service.split('+')[0].trim();
      serviceCounts[mainSrv] = (serviceCounts[mainSrv] || 0) + 1;
    });
    const serviceSummaryStr = Object.entries(serviceCounts).map(([k, v]) => `${k} ${v}`).join(' · ');

    return { count: empTx.length, total: totalOmset, summary: serviceSummaryStr };
  };

  const getWeeklyTrend = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
      const dayTx = transactions.filter(t => t.date === dateStr);
      const dayOmset = dayTx.reduce((sum, t) => sum + t.amount, 0);
      days.push({ dayName, dateStr, omset: dayOmset });
    }
    return days;
  };
  const weeklyTrend = getWeeklyTrend();
  const maxWeeklyOmset = Math.max(...weeklyTrend.map(w => w.omset), 100000);

  if (!role) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-8 bg-[url('https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800')] bg-cover bg-center bg-fixed">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-0"></div>
        <div className="z-10 space-y-6">
          <img src={logo} alt="Logo" className="w-48 h-48 mx-auto rounded-full object-cover border-4 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.4)]" />
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-white mb-2 uppercase drop-shadow-lg">
              Rekap <span className="text-amber-500">GC BANG ALL</span>
            </h1>
            <p className="text-neutral-300 font-medium text-sm">Sistem Kasir & Manajemen Professional</p>
            {isLoading && <p className="text-amber-500 text-xs mt-2 animate-pulse">Menghubungkan ke Database Realtime...</p>}
          </div>
          <div className="flex flex-col gap-4 w-full max-w-xs mx-auto">
            <button 
              onClick={() => setRole('karyawan_login')}
              disabled={isLoading}
              className="w-full py-4 bg-white text-black font-extrabold rounded-2xl hover:bg-neutral-200 transition flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 text-sm"
            >
              <UserCheck size={18} /> Masuk Kapster
            </button>
            <button 
              onClick={() => setRole('owner_login')}
              disabled={isLoading}
              className="w-full py-4 bg-amber-500 text-black font-extrabold rounded-2xl hover:bg-amber-400 transition flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 text-sm"
            >
              <Shield size={18} /> Masuk Owner
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (role === 'owner_login') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-black">
        <div className="w-full max-w-sm bg-[#141414] border border-[#262626] p-8 rounded-3xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <ShieldAlert size={40} className="mx-auto text-amber-500" />
            <h2 className="text-2xl font-bold text-white">Verifikasi Owner</h2>
            <p className="text-sm text-neutral-400">Masukkan PIN Anda</p>
          </div>
          <form onSubmit={handleOwnerLogin} className="space-y-4">
            <input 
              type="password" 
              value={ownerPinInput}
              onChange={(e) => setOwnerPinInput(e.target.value)}
              className="w-full text-center tracking-[1em] text-2xl font-bold bg-black border border-neutral-800 rounded-2xl p-4 text-amber-500 focus:border-amber-500 outline-none"
              placeholder="••••"
              maxLength="6"
              autoFocus
            />
            <button type="submit" disabled={pinChecking} className="w-full py-4 bg-amber-500 text-black font-extrabold rounded-2xl hover:bg-amber-400 transition shadow-lg shadow-amber-500/20 text-sm">
              Akses Dashboard
            </button>
            <button type="button" onClick={() => setRole(null)} className="w-full py-4 bg-transparent text-neutral-400 font-bold rounded-2xl hover:text-white transition text-sm">
              Kembali
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (role === 'karyawan_login') {
    setRole('karyawan');
    setActiveTab('pos');
  }

  return (
    <div className="min-h-screen bg-black pb-28 text-white">
      <header className="bg-[#141414] border-b border-[#262626] sticky top-0 z-50">
        <div className="flex justify-between items-center px-4 py-3.5">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-9 h-9 rounded-full border border-amber-500 object-cover" />
            <div>
              <h1 className="font-black text-white leading-tight flex items-center gap-2 text-xs sm:text-sm">
                Rekap GC BANG ALL <span className="flex items-center gap-1 text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> Live</span>
              </h1>
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">{role === 'owner' ? 'Owner Dashboard' : 'Kapster Mode'}</p>
            </div>
          </div>
          <button 
            onClick={() => { setRole(null); setOwnerPinInput(''); }}
            className="p-2 text-red-400 bg-red-400/10 rounded-xl hover:bg-red-400/20 transition flex items-center gap-1 text-xs font-bold"
          >
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </header>

      <main className="p-4 max-w-md sm:max-w-3xl lg:max-w-5xl mx-auto space-y-6">
        
        {/* ========================================================= */}
        {/* KAPSTER / KARYAWAN VIEW                                   */}
        {/* ========================================================= */}
        {activeTab === 'pos' && role === 'karyawan' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-1.5 bg-[#141414] p-1.5 rounded-2xl border border-[#262626]">
              <button 
                onClick={() => setEmployeeSubTab('transaksi')}
                className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition ${employeeSubTab === 'transaksi' ? 'bg-white text-black shadow-lg' : 'text-neutral-400 hover:text-white'}`}
              >
                <Scissors size={14} /> Transaksi
              </button>
              <button 
                onClick={() => setEmployeeSubTab('riwayat')}
                className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition ${employeeSubTab === 'riwayat' ? 'bg-white text-black shadow-lg' : 'text-neutral-400 hover:text-white'}`}
              >
                <FileText size={14} /> Riwayat
              </button>
              <button 
                onClick={() => setEmployeeSubTab('pengeluaran')}
                className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition ${employeeSubTab === 'pengeluaran' ? 'bg-amber-500 text-black shadow-lg' : 'text-neutral-400 hover:text-white'}`}
              >
                <Receipt size={14} /> Pengeluaran
              </button>
              <button 
                onClick={() => setEmployeeSubTab('nabung')}
                className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition ${employeeSubTab === 'nabung' ? 'bg-emerald-500 text-black shadow-lg' : 'text-neutral-400 hover:text-white'}`}
              >
                <Banknote size={14} /> Nabung
              </button>
            </div>

            <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex justify-between items-center">
              <span className="text-xs font-semibold text-neutral-400">Tanggal Aktif:</span>
              <input 
                type="date" 
                value={transactionDate} 
                onChange={(e) => setTransactionDate(e.target.value)} 
                className="bg-black border border-neutral-700 px-3 py-1.5 rounded-xl text-white text-xs outline-none font-bold"
              />
            </div>

            {employeeSubTab === 'transaksi' && (
              <div className="space-y-6">
                <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">Tambah Transaksi Baru</h2>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> Live Kasir
                    </span>
                  </div>

                  <form onSubmit={handleTransactionSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-400 mb-1">Pilih Kapster</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {employees.filter(e => e.active).map(emp => (
                          <button
                            key={emp.name}
                            type="button"
                            onClick={() => setSelectedEmployee(emp.name)}
                            className={`py-3 rounded-xl text-sm font-black uppercase border transition ${selectedEmployee === emp.name ? 'bg-amber-500 text-black border-amber-500 shadow-md' : 'bg-black text-neutral-400 border-neutral-800'}`}
                          >
                            {emp.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-400 mb-1">Layanan Utama (tekan + untuk menambah)</label>
                      <div className="space-y-2">
                        {services.length === 0 && <p className="text-xs text-neutral-500">Belum ada layanan.</p>}
                        {services.map(srv => {
                          const q = serviceQty[srv.id] || 0;
                          return (
                            <div key={srv.id} className={`p-3 rounded-xl border flex justify-between items-center transition ${q > 0 ? 'bg-amber-500/10 border-amber-500' : 'bg-black border-neutral-800'}`}>
                              <div>
                                <p className="text-xs font-bold text-white">{srv.name}</p>
                                <p className="text-[10px] text-neutral-400">Rp {srv.price.toLocaleString()}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <button type="button" onClick={() => setQty(srv.id, -1)} className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-700 flex items-center justify-center font-bold text-white hover:bg-neutral-800">
                                  <Minus size={14} />
                                </button>
                                <span className="font-bold text-sm w-4 text-center">{q}</span>
                                <button type="button" onClick={() => setQty(srv.id, 1)} className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold hover:bg-neutral-200">
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <label className="block text-xs font-medium text-neutral-400">Tambahan (Opsional)</label>
                      <div 
                        onClick={() => setUseKeramas(!useKeramas)}
                        className={`p-3 rounded-xl border flex justify-between items-center cursor-pointer transition ${useKeramas ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-black border-neutral-800 text-neutral-300'}`}
                      >
                        <div className="flex items-center gap-3 text-xs font-semibold">
                          <input type="checkbox" checked={useKeramas} onChange={() => {}} className="rounded accent-amber-500 w-4 h-4" />
                          Keramas
                        </div>
                        <span className="text-xs font-bold">+Rp 5.000</span>
                      </div>

                      <div 
                        onClick={() => setUseKumis(!useKumis)}
                        className={`p-3 rounded-xl border flex justify-between items-center cursor-pointer transition ${useKumis ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-black border-neutral-800 text-neutral-300'}`}
                      >
                        <div className="flex items-center gap-3 text-xs font-semibold">
                          <input type="checkbox" checked={useKumis} onChange={() => {}} className="rounded accent-amber-500 w-4 h-4" />
                          Kumis & Jenggot
                        </div>
                        <span className="text-xs font-bold">+Rp 5.000</span>
                      </div>
                    </div>

                    <div className="p-3 bg-black border border-neutral-800 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-white">Hairtonix</p>
                          <p className="text-[10px] text-neutral-400">Rp 25.000</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            type="button" 
                            onClick={() => setHairtonixQty(Math.max(0, hairtonixQty - 1))}
                            className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-700 flex items-center justify-center font-bold text-white hover:bg-neutral-800"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="font-bold text-sm w-4 text-center">{hairtonixQty}</span>
                          <button 
                            type="button" 
                            onClick={() => setHairtonixQty(hairtonixQty + 1)}
                            className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold hover:bg-neutral-200"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-400 mb-1">Nama Pelanggan (Opsional)</label>
                      <input 
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Contoh: Andi"
                        className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white outline-none"
                      />
                    </div>

                    <div className="p-4 bg-black border border-neutral-800 rounded-xl flex justify-between items-center">
                      <span className="text-xs text-neutral-400 font-semibold">Total:</span>
                      <span className="text-xl font-black text-amber-400">Rp {calculatedTotalAmount.toLocaleString()}</span>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-400 mb-1">Bayar *</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('Tunai')}
                          className={`py-3 px-2 rounded-xl text-xs font-bold border transition text-center ${paymentMethod === 'Tunai' ? 'bg-white text-black border-white shadow-md' : 'bg-black text-neutral-400 border-neutral-800'}`}
                        >
                          <div>Tunai</div>
                          <span className="text-[9px] opacity-70 font-normal">masuk laci</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('QRIS')}
                          className={`py-3 px-2 rounded-xl text-xs font-bold border transition text-center ${paymentMethod === 'QRIS' ? 'bg-white text-black border-white shadow-md' : 'bg-black text-neutral-400 border-neutral-800'}`}
                        >
                          <div>QRIS/Transfer</div>
                          <span className="text-[9px] opacity-70 font-normal">tidak masuk laci</span>
                        </button>
                      </div>
                    </div>

                    <button type="submit" disabled={busy} className="w-full py-4 bg-amber-500 text-black font-black rounded-xl shadow-lg hover:bg-amber-400 transition text-sm uppercase tracking-wider disabled:opacity-60">
                      {busy ? 'Menyimpan...' : '✓ Catat Transaksi Selesai'}
                    </button>
                  </form>
                </div>

                {/* Hasil Kerja / Pendapatan Kapster (Otomatis Terkalkulasi untuk Kapster) */}
                <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-white">Hasil Kerja & Pendapatan Anda Hari Ini</h3>
                  {(() => {
                    const expQ = totalExpenseAmount - todayExpTunai;
                    const Row = ({ l, v, c }) => (<div className="flex justify-between text-xs"><span className="text-neutral-400">{l}</span><span className={`font-bold ${c || 'text-white'}`}>Rp {v.toLocaleString()}</span></div>);
                    return (
                      <div className="bg-black border border-amber-500/30 rounded-xl p-4 space-y-2">
                        <p className="text-xs font-bold text-amber-400">TOTAL SEMUA KAPSTER ({activeDateForView})</p>
                        <Row l="Pendapatan Tunai" v={totalTunai} />
                        <Row l="Pendapatan QRIS" v={totalQris} />
                        <div className="border-t border-neutral-800 pt-2"><Row l="Total Pendapatan" v={totalSales} c="text-amber-400" /></div>
                        <Row l="Pengeluaran Tunai" v={todayExpTunai} c="text-red-400" />
                        <Row l="Pengeluaran QRIS" v={expQ} c="text-red-400" />
                        <div className="border-t border-neutral-800 pt-2"><Row l="Total Pengeluaran" v={totalExpenseAmount} c="text-red-400" /></div>
                        <div className="border-t border-neutral-800 pt-2"><Row l="Pendapatan Bersih" v={totalSales - totalExpenseAmount} c="text-emerald-400" /></div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="bg-[#141414] rounded-lg p-2 text-[11px]"><span className="text-neutral-500">Bersih Tunai</span><p className="font-black text-emerald-400">Rp {(totalTunai - todayExpTunai).toLocaleString()}</p></div>
                          <div className="bg-[#141414] rounded-lg p-2 text-[11px]"><span className="text-neutral-500">Bersih QRIS</span><p className="font-black text-emerald-400">Rp {(totalQris - expQ).toLocaleString()}</p></div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="space-y-3">
                    {employees.filter(e => e.active).map(emp => {
                      const stats = getEmployeeStatsForDate(emp.name, activeDateForView);
                      const ratioParts = emp.ratio.split('/');
                      const pct = parseFloat(ratioParts[0]) || 60;
                      const myEarnings = (stats.total * pct) / 100;
                      const isMySelf = emp.name.toLowerCase() === selectedEmployee.toLowerCase();

                      if (!isMySelf && !canViewOtherEarnings) return null;

                      return (
                        <div key={emp.name} className="bg-black border border-neutral-800 rounded-xl p-4 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-white uppercase text-sm">{emp.name} {isMySelf && <span className="text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-bold ml-1">ANDA</span>}</span>
                            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                              ✂️ {stats.count} kepala
                            </span>
                          </div>
                          {stats.summary && (
                            <p className="text-xs text-neutral-300 pt-1">
                              <span className="text-neutral-500 font-semibold">Layanan:</span> {stats.summary}
                            </p>
                          )}
                          <div className="flex justify-between items-center pt-2 border-t border-neutral-900 text-xs">
                            <span className="text-neutral-400">Total Omset:</span>
                            <span className="font-bold text-white">Rp {stats.total.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center pt-1 text-xs">
                            <span className="text-neutral-400">Estimasi Bagi Hasil ({emp.ratio}):</span>
                            <span className="font-black text-amber-400 text-sm">Rp {myEarnings.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {employeeSubTab === 'riwayat' && (
              <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Trash2 size={16} className="text-red-400" /> Riwayat Transaksi & Penghapusan
                </h3>
                <div className="space-y-2">
                  {todayTransactions.length === 0 ? (
                    <p className="text-xs text-neutral-500">Belum ada transaksi pada tanggal ini.</p>
                  ) : (
                    todayTransactions.map(t => (
                      <div key={t.id} className="flex justify-between items-center p-3 bg-neutral-900 rounded-xl text-xs">
                        <div>
                          <p className="font-bold text-white uppercase">{t.employee} • <span className="text-amber-400">{t.service}</span></p>
                          <p className="text-neutral-400">Jam: {t.transaction_time || '-'} • Rp {t.amount.toLocaleString()} ({t.payment_method})</p>
                        </div>
                        <button 
                          onClick={() => handleDeleteTransaction(t)}
                          className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-bold transition"
                        >
                          Hapus
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {employeeSubTab === 'nabung' && (
              <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-5">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Banknote size={16} className="text-emerald-400" /> Nabung untuk Bayar Ruko
                  </h3>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                    Terkumpul Rp {totalTabungan.toLocaleString()}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="w-full h-3 bg-black rounded-full overflow-hidden border border-neutral-800">
                    <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ width: `${progressTabungan}%` }}></div>
                  </div>
                  <p className="text-[11px] text-neutral-400">{progressTabungan.toFixed(1)}% dari target Rp {targetTabungan.toLocaleString()} (sampai 28 Feb 2027)</p>
                </div>
                <div className="bg-black border border-neutral-800 rounded-xl p-4 space-y-1">
                  <p className="text-xs text-neutral-400">{todayIsMonday ? 'Hari ini Senin: libur nabung.' : 'Target nabung hari ini:'}</p>
                  {!todayIsMonday && <p className="text-xl font-black text-amber-400">Rp {targetPerDay.toLocaleString()}</p>}
                  <p className="text-[11px] text-neutral-500">Sudah ditabung hari ini: Rp {savedToday.toLocaleString()}</p>
                </div>
                <form onSubmit={handleAddSaving} className="space-y-3 bg-black p-4 rounded-xl border border-neutral-800">
                  <p className="text-xs font-bold text-emerald-400">Setor Tabungan Ruko ({transactionDate})</p>
                  <input name="savingAmount" type="number" min="1" placeholder="Nominal (Rp)" className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white outline-none" required />
                  <button type="submit" disabled={busy} className="w-full py-3 bg-emerald-500/20 text-emerald-400 font-bold rounded-xl border border-emerald-500/30 hover:bg-emerald-500/30 transition text-xs disabled:opacity-60">
                    + Simpan Tabungan
                  </button>
                </form>
                <div className="space-y-2">
                  <p className="text-xs font-bold text-neutral-400 uppercase">Riwayat Setoran</p>
                  {savings.length === 0 && <p className="text-xs text-neutral-500">Belum ada setoran.</p>}
                  {savings.slice(0, 15).map(sv => (
                    <div key={sv.id} className="flex justify-between bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs">
                      <span className="text-neutral-400">{sv.date}</span>
                      <span className="font-bold text-emerald-400">Rp {sv.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {employeeSubTab === 'pengeluaran' && (
              <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-5">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Receipt size={16} className="text-amber-400" /> Layout Laporan Pengeluaran
                  </h3>
                  <span className="text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1 rounded-full">
                    - Rp {totalExpenseAmount.toLocaleString()}
                  </span>
                </div>

                <form onSubmit={handleAddExpense} className="space-y-3 bg-black p-4 rounded-xl border border-neutral-800">
                  <p className="text-xs font-bold text-amber-400">Catat Pengeluaran Baru</p>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Siapa yang Mengeluarkan?</label>
                    <select 
                      value={expenseSpender}
                      onChange={(e) => setExpenseSpender(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl p-2.5 text-xs text-white outline-none capitalize"
                    >
                      <option value="owner">Owner</option>
                      {employees.map(emp => (
                        <option key={emp.name} value={emp.name}>{emp.name.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Dibayar Pakai</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Tunai', 'QRIS'].map(m => (
                        <button key={m} type="button" onClick={() => setExpensePayment(m)}
                          className={`py-2 rounded-xl text-xs font-bold border ${expensePayment === m ? 'bg-amber-500 text-black border-amber-500' : 'bg-black text-neutral-400 border-neutral-800'}`}>{m}</button>
                      ))}
                    </div>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Keterangan Pengeluaran (Cth: Beli Klem, Listrik)"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl p-2.5 text-xs text-white outline-none"
                    required 
                  />
                  <input 
                    type="number" 
                    placeholder="Nominal (Rp)"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl p-2.5 text-xs text-white outline-none"
                    required 
                  />
                  <button type="submit" disabled={busy} className="w-full py-3 bg-red-500/20 text-red-400 font-bold rounded-xl border border-red-500/30 hover:bg-red-500/30 transition text-xs disabled:opacity-60">
                    + Simpan Pengeluaran
                  </button>
                </form>

                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-neutral-300">Rincian Pengeluaran Tanggal: {transactionDate}</h4>
                  {todayExpenses.length === 0 ? (
                    <p className="text-xs text-neutral-500 py-4 text-center">Belum ada pengeluaran pada tanggal ini.</p>
                  ) : (
                    todayExpenses.map(e => (
                      <div key={e.id} className="p-3.5 bg-neutral-900 rounded-xl flex justify-between items-center text-xs border border-neutral-800">
                        <div className="space-y-1">
                          <p className="font-bold text-white">{expText(e)} {expMethod(e) === 'QRIS' && <span className="ml-1 text-[9px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded-full">QRIS</span>}</p>
                          <p className="text-[10px] text-neutral-400 font-mono">Jam: {e.expense_time || '-'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-red-400">- Rp {e.amount.toLocaleString()}</span>
                          <button onClick={() => handleDeleteExpense(e)} className="p-1.5 bg-red-500/20 text-red-400 rounded-lg">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* OWNER MODE - TABS CORRESPONDING TO SCREENSHOT BOTTOM NAV  =*/}
        {/* ========================================================= */}
        {role === 'owner' && (
          <>
            {/* 1. HARI INI TAB (POS & DAILY TRANSACTIONS) */}
            {activeTab === 'pos' && (() => {
              const filteredPosTx = filterTransactionsByRange(transactions, selectedDate, posFilter);
              const totalPosSales = filteredPosTx.reduce((sum, t) => sum + t.amount, 0);

              return (
                <div className="space-y-6">
                  <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl flex justify-between items-center flex-wrap gap-3">
                    <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                      <Scissors size={18} /> Transaksi ({posFilter})
                    </h2>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-black border border-neutral-800 p-2.5 rounded-xl text-white outline-none text-sm font-bold" />
                  </div>

                  {/* Period Filter Buttons for POS / Transactions */}
                  <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 shadow-xl space-y-3">
                    <p className="text-xs font-bold text-neutral-400 uppercase">Filter Periode Transaksi:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['harian', 'mingguan', 'bulanan'].map(range => (
                        <button
                          key={range}
                          type="button"
                          onClick={() => setPosFilter(range)}
                          className={`py-2.5 rounded-xl text-xs font-bold border capitalize transition ${posFilter === range ? 'bg-amber-500 text-black border-amber-500' : 'bg-black text-neutral-400 border-neutral-800'}`}
                        >
                          {range}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-white">Daftar Transaksi ({posFilter.toUpperCase()})</h3>
                      <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full">
                        Rp {totalPosSales.toLocaleString()}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-neutral-800 text-neutral-400 font-bold">
                            <th className="py-3 px-2">NO</th>
                            <th className="py-3 px-2">TGL & JAM</th>
                            <th className="py-3 px-2">KAPSTER</th>
                            <th className="py-3 px-2">LAYANAN</th>
                            <th className="py-3 px-2">BAYAR</th>
                            <th className="py-3 px-2">NOMINAL</th>
                            <th className="py-3 px-2 text-right">AKSI</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-900">
                          {filteredPosTx.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="py-6 text-center text-neutral-500">Belum ada transaksi pada periode ini.</td>
                            </tr>
                          ) : (
                            filteredPosTx.map((t, index) => (
                              <tr key={t.id} className="hover:bg-neutral-900/50">
                                <td className="py-3 px-2 font-mono text-neutral-400">{index + 1}</td>
                                <td className="py-3 px-2 font-mono text-emerald-400 font-semibold">{t.date} {t.transaction_time || ''}</td>
                                <td className="py-3 px-2 font-bold text-white uppercase">{t.employee}</td>
                                <td className="py-3 px-2 text-neutral-300">{t.service}</td>
                                <td className="py-3 px-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${t.payment_method === 'Tunai' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                    {t.payment_method}
                                  </span>
                                </td>
                                <td className="py-3 px-2 font-black text-amber-500">Rp {t.amount.toLocaleString()}</td>
                                <td className="py-3 px-2 text-right">
                                  <button onClick={() => handleDeleteTransaction(t)} className="p-1.5 bg-red-500/20 text-red-400 rounded-lg">
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 2. KAS TAB */}
            {activeTab === 'kas' && (() => {
              let kasFilteredTx = [...transactions];
              let kasFilteredExp = [...expenses];
              const now = new Date(selectedDate);

              if (kasFilter === 'harian') {
                kasFilteredTx = transactions.filter(t => t.date === selectedDate);
                kasFilteredExp = expenses.filter(e => e.date === selectedDate);
              } else if (kasFilter === 'mingguan') {
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - 6);
                kasFilteredTx = transactions.filter(t => {
                  const d = new Date(t.date);
                  return d >= startOfWeek && d <= now;
                });
                kasFilteredExp = expenses.filter(e => {
                  const d = new Date(e.date);
                  return d >= startOfWeek && d <= now;
                });
              } else if (kasFilter === 'bulanan') {
                const year = now.getFullYear();
                const month = now.getMonth();
                kasFilteredTx = transactions.filter(t => {
                  const d = new Date(t.date);
                  return d.getFullYear() === year && d.getMonth() === month;
                });
                kasFilteredExp = expenses.filter(e => {
                  const d = new Date(e.date);
                  return d.getFullYear() === year && d.getMonth() === month;
                });
              }

              const kSales = kasFilteredTx.reduce((sum, t) => sum + t.amount, 0);
              const kTunai = kasFilteredTx.filter(t => t.payment_method === 'Tunai').reduce((sum, t) => sum + t.amount, 0);
              const kQris = kasFilteredTx.filter(t => t.payment_method === 'QRIS').reduce((sum, t) => sum + t.amount, 0);
              const kExp = kasFilteredExp.reduce((sum, e) => sum + e.amount, 0);
              const kExpTunai = kasFilteredExp.filter(e => expMethod(e) === 'Tunai').reduce((sum, e) => sum + e.amount, 0);
              const kExpQris = kExp - kExpTunai;
              const kDrawer = kTunai - kExpTunai;
              const kNet = kSales - kExp;

              return (
                <div className="space-y-6">
                  <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl flex justify-between items-center flex-wrap gap-3">
                    <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                      <Wallet size={18} /> Manajemen Kas & Pengeluaran
                    </h2>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-black border border-neutral-800 p-2.5 rounded-xl text-white outline-none text-sm font-bold" />
                  </div>

                  {/* Period Filter Buttons for Kas */}
                  <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 shadow-xl space-y-3">
                    <p className="text-xs font-bold text-neutral-400 uppercase">Filter Periode Kas:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['harian', 'mingguan', 'bulanan'].map(range => (
                        <button
                          key={range}
                          type="button"
                          onClick={() => setKasFilter(range)}
                          className={`py-2.5 rounded-xl text-xs font-bold border capitalize transition ${kasFilter === range ? 'bg-amber-500 text-black border-amber-500' : 'bg-black text-neutral-400 border-neutral-800'}`}
                        >
                          {range}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-3">
                      <p className="text-xs text-neutral-400 font-bold uppercase">Uang Tunai di Laci ({kasFilter})</p>
                      <h3 className="text-2xl font-black text-emerald-400">Rp {kDrawer.toLocaleString()}</h3>
                      <p className="text-[11px] text-neutral-500">Tunai Masuk: Rp {kTunai.toLocaleString()} | Pengeluaran: -Rp {kExp.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-3">
                      <p className="text-xs text-neutral-400 font-bold uppercase">Total QRIS / Transfer ({kasFilter})</p>
                      <h3 className="text-2xl font-black text-blue-400">Rp {kQris.toLocaleString()}</h3>
                      <p className="text-[11px] text-neutral-500">Tidak masuk ke laci kasir fisik</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-2">
                      <p className="text-xs text-neutral-400 font-bold">TOTAL OMSET ({kasFilter.toUpperCase()})</p>
                      <h3 className="text-xl font-black text-amber-500">Rp {kSales.toLocaleString()}</h3>
                    </div>
                    <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-2">
                      <p className="text-xs text-neutral-400 font-bold">TOTAL PENGELUARAN ({kasFilter.toUpperCase()})</p>
                      <h3 className="text-xl font-black text-red-400">-Rp {kExp.toLocaleString()}</h3>
                    </div>
                    <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-2">
                      <p className="text-xs text-neutral-400 font-bold">PENDAPATAN BERSIH ({kasFilter.toUpperCase()})</p>
                      <h3 className="text-xl font-black text-emerald-400">Rp {kNet.toLocaleString()}</h3>
                    </div>
                  </div>

                  {/* LAPORAN PENDAPATAN BERSIH: TUNAI & QRIS DIPISAH */}
                  <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <TrendingUp size={16} className="text-emerald-400" /> Pendapatan Bersih Tunai & QRIS ({kasFilter})
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-black border border-neutral-800 rounded-xl p-3 space-y-1">
                        <p className="text-[11px] font-bold text-neutral-400 flex items-center gap-1"><Banknote size={12} /> TUNAI</p>
                        <p className="text-[11px] text-neutral-500">Masuk Rp {kTunai.toLocaleString()}</p>
                        <p className="text-[11px] text-red-400">Pengeluaran -Rp {kExpTunai.toLocaleString()}</p>
                        <p className="text-base font-black text-emerald-400">Rp {(kTunai - kExpTunai).toLocaleString()}</p>
                      </div>
                      <div className="bg-black border border-neutral-800 rounded-xl p-3 space-y-1">
                        <p className="text-[11px] font-bold text-neutral-400 flex items-center gap-1"><CreditCard size={12} /> QRIS</p>
                        <p className="text-[11px] text-neutral-500">Masuk Rp {kQris.toLocaleString()}</p>
                        <p className="text-[11px] text-red-400">Pengeluaran -Rp {kExpQris.toLocaleString()}</p>
                        <p className="text-base font-black text-emerald-400">Rp {(kQris - kExpQris).toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-neutral-500">Pengeluaran dipisah sesuai metode bayar yang dipilih saat input (data lama dianggap tunai). Total bersih = Rp {kNet.toLocaleString()}.</p>
                  </div>

                  {/* REKAP PENGELUARAN OWNER vs KAPSTER */}
                  <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Receipt size={16} className="text-amber-400" /> Rekap Pengeluaran: Owner vs Kapster
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-neutral-400 text-left">
                            <th className="py-2">Periode</th><th className="py-2 text-right">Owner</th><th className="py-2 text-right">Kapster</th><th className="py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {['harian', 'mingguan', 'bulanan'].map(r => {
                            const x = expSplit(r, selectedDate);
                            return (
                              <tr key={r} className="border-t border-neutral-800 text-white">
                                <td className="py-2 capitalize font-bold">{r}</td>
                                <td className="py-2 text-right">Rp {x.owner.toLocaleString()}</td>
                                <td className="py-2 text-right">Rp {x.kapster.toLocaleString()}</td>
                                <td className="py-2 text-right font-bold text-red-400">Rp {x.total.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {(() => {
                      const per = {};
                      kasFilteredExp.forEach(e => { const n = expSpender(e); per[n] = (per[n] || 0) + e.amount; });
                      const names = Object.keys(per);
                      return names.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <p className="text-[11px] font-bold text-neutral-400 uppercase">Per orang ({kasFilter})</p>
                          {names.map(n => (
                            <div key={n} className="flex justify-between text-xs bg-black border border-neutral-800 rounded-lg px-3 py-2">
                              <span className="text-white">{n === 'OWNER' ? 'OWNER' : `Kapster ${n}`}</span>
                              <span className="font-bold text-red-400">Rp {per[n].toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <p className="text-[10px] text-neutral-500">Harian = tanggal terpilih; Mingguan = 7 hari berakhir di tanggal terpilih; Bulanan = bulan dari tanggal terpilih.</p>
                  </div>

                  <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-4">
                    <h3 className="text-sm font-bold text-white">Catat Pengeluaran Baru</h3>
                    <form onSubmit={handleAddExpense} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select 
                          value={expenseSpender}
                          onChange={(e) => setExpenseSpender(e.target.value)}
                          className="bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white capitalize outline-none"
                        >
                          <option value="owner">Pengeluaran Owner</option>
                          {employees.map(emp => (
                            <option key={emp.name} value={emp.name}>Pengeluaran {emp.name.toUpperCase()}</option>
                          ))}
                        </select>
                        <input 
                          type="number" 
                          placeholder="Nominal (Rp)" 
                          value={expenseAmount} 
                          onChange={(e) => setExpenseAmount(e.target.value)} 
                          className="bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white outline-none" 
                          required 
                        />
                      </div>
                      <div className="">
                    <label className="block text-[11px] text-neutral-400 mb-1">Dibayar Pakai</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Tunai', 'QRIS'].map(m => (
                        <button key={m} type="button" onClick={() => setExpensePayment(m)}
                          className={`py-2 rounded-xl text-xs font-bold border ${expensePayment === m ? 'bg-amber-500 text-black border-amber-500' : 'bg-black text-neutral-400 border-neutral-800'}`}>{m}</button>
                      ))}
                    </div>
                  </div>
                      <input 
                        type="text" 
                        placeholder="Keterangan Pengeluaran" 
                        value={expenseDesc} 
                        onChange={(e) => setExpenseDesc(e.target.value)} 
                        className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white outline-none" 
                        required 
                      />
                      <button type="submit" disabled={busy} className="w-full py-3 bg-red-500/20 text-red-400 font-bold rounded-xl border border-red-500/30 hover:bg-red-500/30 transition text-xs disabled:opacity-60">
                        + Simpan Pengeluaran
                      </button>
                    </form>
                  </div>
                </div>
              );
            })()}

            {/* 3. GAJI TAB */}
            {activeTab === 'gaji' && (
              <div className="space-y-6">
                <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl flex justify-between items-center flex-wrap gap-3">
                  <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                    <Users size={18} /> Skema Gaji & Slip Kapster
                  </h2>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-black border border-neutral-800 p-2.5 rounded-xl text-white outline-none text-sm font-bold" />
                </div>

                {/* Period Filter Buttons for Gaji */}
                <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 shadow-xl space-y-3">
                  <p className="text-xs font-bold text-neutral-400 uppercase">Filter Periode Gaji & Rekapan:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {['harian', 'mingguan', 'bulanan'].map(range => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setGajiFilter(range)}
                        className={`py-2.5 rounded-xl text-xs font-bold border capitalize transition ${gajiFilter === range ? 'bg-amber-500 text-black border-amber-500' : 'bg-black text-neutral-400 border-neutral-800'}`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {employees.filter(e => e.active).map(emp => {
                    const stats = getEmployeeStatsForRange(emp.name, selectedDate, gajiFilter);
                    // Calculate commission split based on ratio (e.g. "60/40" -> Kapster gets 60% of total omset or custom calculation)
                    const ratioParts = emp.ratio.split('/');
                    const kapsterPercentage = parseFloat(ratioParts[0]) || 60;
                    const computedSalary = (stats.total * kapsterPercentage) / 100;

                    return (
                      <div key={emp.name} className="bg-[#141414] border border-[#262626] rounded-2xl p-6 shadow-xl space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xl font-black uppercase text-white">{emp.name}</h3>
                          <span className="text-xs font-bold bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full border border-amber-500/20">
                            Skema: {emp.ratio}
                          </span>
                        </div>
                        <div className="space-y-2 text-xs text-neutral-300">
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Total Kepala:</span>
                            <span className="font-bold text-white">{stats.count} Kepala</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Total Omset:</span>
                            <span className="font-bold text-white">Rp {stats.total.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-neutral-800">
                            <span className="text-amber-400 font-bold">Estimasi Bagi Hasil ({emp.ratio}):</span>
                            <span className="font-black text-amber-400 text-sm">Rp {computedSalary.toLocaleString()}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setSlipModalEmp(emp);
                            setSlipBon('');
                            setSlipMeal('');
                          }}
                          className="w-full py-3 bg-amber-500 text-black font-extrabold rounded-xl hover:bg-amber-400 transition text-xs flex items-center justify-center gap-2 shadow-lg"
                        >
                          <Printer size={15} /> Buat & Kirim Slip Gaji
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. REKAP TAB */}
            {activeTab === 'recap' && (
              <div className="space-y-6">
                <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl flex justify-between items-center">
                  <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                    <TrendingUp size={18} /> Rekap Keuangan & Tren Omset
                  </h2>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-black border border-neutral-800 p-2.5 rounded-xl text-white outline-none text-sm font-bold" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-2">
                    <p className="text-xs text-neutral-400 font-bold">TOTAL OMSET</p>
                    <h3 className="text-2xl font-black text-amber-500">Rp {totalSales.toLocaleString()}</h3>
                  </div>
                  <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-2">
                    <p className="text-xs text-neutral-400 font-bold">TOTAL PENGELUARAN</p>
                    <h3 className="text-2xl font-black text-red-400">- Rp {totalExpenseAmount.toLocaleString()}</h3>
                  </div>
                  <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-2">
                    <p className="text-xs text-neutral-400 font-bold">PENDAPATAN BERSIH</p>
                    <h3 className="text-2xl font-black text-emerald-400">Rp {netIncome.toLocaleString()}</h3>
                  </div>
                </div>

                {(() => {
                  const r = methodReport(recapFilter, selectedDate);
                  const Row = ({ label, v, cls }) => (<div className="flex justify-between text-xs"><span className="text-neutral-400">{label}</span><span className={`font-bold ${cls || 'text-white'}`}>Rp {v.toLocaleString()}</span></div>);
                  return (
                    <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-4">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Wallet size={16} className="text-amber-400" /> Rekap Tunai & QRIS ({recapFilter})
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {['harian', 'mingguan', 'bulanan'].map(x => (
                          <button key={x} type="button" onClick={() => setRecapFilter(x)}
                            className={`py-2 rounded-xl text-xs font-bold border capitalize transition ${recapFilter === x ? 'bg-amber-500 text-black border-amber-500' : 'bg-black text-neutral-400 border-neutral-800'}`}>{x}</button>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-black border border-neutral-800 rounded-xl p-4 space-y-2">
                          <p className="text-xs font-bold text-neutral-300 flex items-center gap-1"><Banknote size={13} /> TUNAI</p>
                          <Row label="Pendapatan tunai" v={r.inT} cls="text-amber-400" />
                          <Row label="Pengeluaran tunai" v={r.outT} cls="text-red-400" />
                          <div className="border-t border-neutral-800 pt-2"><Row label="Bersih tunai" v={r.netT} cls="text-emerald-400" /></div>
                        </div>
                        <div className="bg-black border border-neutral-800 rounded-xl p-4 space-y-2">
                          <p className="text-xs font-bold text-neutral-300 flex items-center gap-1"><CreditCard size={13} /> QRIS</p>
                          <Row label="Pendapatan QRIS" v={r.inQ} cls="text-amber-400" />
                          <Row label="Pengeluaran QRIS" v={r.outQ} cls="text-red-400" />
                          <div className="border-t border-neutral-800 pt-2"><Row label="Bersih QRIS" v={r.netQ} cls="text-emerald-400" /></div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center bg-black border border-emerald-500/30 rounded-xl px-4 py-3">
                        <span className="text-xs font-bold text-neutral-300">TOTAL BERSIH (TUNAI + QRIS)</span>
                        <span className="text-lg font-black text-emerald-400">Rp {r.net.toLocaleString()}</span>
                      </div>
                      <p className="text-[10px] text-neutral-500">Harian = tanggal terpilih; Mingguan = 7 hari berakhir di tanggal itu; Bulanan = bulan dari tanggal itu.</p>
                    </div>
                  );
                })()}

                {/* WEEKLY TREND CHART */}
                <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp size={16} className="text-amber-500" /> Grafik Tren Omset 7 Hari Terakhir
                  </h3>
                  <div className="p-4 bg-black border border-neutral-800 rounded-xl space-y-4">
                    <div className="flex items-end justify-between gap-2 h-40 pt-6 px-2 border-b border-neutral-800">
                      {weeklyTrend.map((w, idx) => {
                        const heightPercent = Math.max((w.omset / maxWeeklyOmset) * 100, 10);
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                            <div className="absolute -top-8 bg-neutral-800 text-amber-400 text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                              Rp {w.omset.toLocaleString()}
                            </div>
                            <span className="text-[10px] text-neutral-400 font-mono">Rp {(w.omset/1000).toFixed(0)}k</span>
                            <div 
                              className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-lg transition-all duration-500 hover:bg-amber-300"
                              style={{ height: `${heightPercent}%` }}
                            ></div>
                            <span className="text-[11px] font-bold text-white uppercase mt-1">{w.dayName}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-neutral-500 text-center">Menampilkan grafik perbandingan omset harian dalam 7 hari ke belakang.</p>
                  </div>
                </div>

                <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2">
                    <FileSpreadsheet size={16} className="text-emerald-400" /> Export Laporan Excel & WhatsApp
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['harian', 'mingguan', 'bulanan', 'semua'].map(range => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setExportRange(range)}
                        className={`py-2.5 rounded-xl text-xs font-bold border capitalize transition ${exportRange === range ? 'bg-amber-500 text-black border-amber-500' : 'bg-black text-neutral-400 border-neutral-800'}`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button onClick={exportToExcel} className="flex items-center justify-center gap-2 p-3.5 bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs">
                      <Download size={18} /> Download Excel ({exportRange})
                    </button>
                    <button onClick={sendReportWA} className="flex items-center justify-center gap-2 p-3.5 bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 rounded-xl font-bold text-xs">
                      <Share2 size={18} /> Kirim Rekap ke WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TABUNGAN RUKO (OWNER) */}
            {activeTab === 'tabungan' && (
              <div className="space-y-6">
                <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-4">
                  <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                    <Banknote size={18} /> Tabungan Bayar Ruko
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black border border-neutral-800 rounded-xl p-3">
                      <p className="text-[11px] text-neutral-400 font-bold">TARGET (28 Feb 2027)</p>
                      <p className="text-base font-black text-white">Rp {targetTabungan.toLocaleString()}</p>
                    </div>
                    <div className="bg-black border border-neutral-800 rounded-xl p-3">
                      <p className="text-[11px] text-neutral-400 font-bold">TERKUMPUL</p>
                      <p className="text-base font-black text-emerald-400">Rp {totalTabungan.toLocaleString()}</p>
                    </div>
                    <div className="bg-black border border-neutral-800 rounded-xl p-3 col-span-2">
                      <p className="text-[11px] text-neutral-400 font-bold">KURANG</p>
                      <p className="text-base font-black text-red-400">Rp {sisaTabungan.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="w-full h-3 bg-black rounded-full overflow-hidden border border-neutral-800">
                      <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ width: `${progressTabungan}%` }}></div>
                    </div>
                    <p className="text-[11px] text-neutral-400">{progressTabungan.toFixed(1)}% tercapai</p>
                  </div>
                </div>

                <div className="bg-[#141414] border border-amber-500/30 rounded-2xl p-5 shadow-xl space-y-3">
                  <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2"><Calendar size={16} /> Kalkulasi Nabung (Senin Libur)</h3>
                  <p className="text-xs text-neutral-300">
                    Dari hari ini ({todayStr}) sampai 28 Februari 2027 ada <b>{tabDays.total} hari</b>, dikurangi <b>{tabDays.mondays} hari Senin</b> = <b>{tabDays.nonMonday} hari nabung</b>.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black border border-neutral-800 rounded-xl p-3">
                      <p className="text-[11px] text-neutral-400 font-bold">HARUS NABUNG / HARI</p>
                      <p className="text-lg font-black text-amber-400">Rp {targetPerDay.toLocaleString()}</p>
                    </div>
                    <div className="bg-black border border-neutral-800 rounded-xl p-3">
                      <p className="text-[11px] text-neutral-400 font-bold">PER MINGGU (6 HARI)</p>
                      <p className="text-lg font-black text-amber-400">Rp {targetPerWeek.toLocaleString()}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    {todayIsMonday ? 'Hari ini Senin (libur nabung). ' : `Setoran hari ini: Rp ${savedToday.toLocaleString()} dari Rp ${targetPerDay.toLocaleString()}. `}
                    Angka ini otomatis menyesuaikan: kalau tabungan kurang/lebih, nominal per hari dihitung ulang dari sisa hari.
                  </p>
                  <p className="text-[10px] text-neutral-500">Hitungan dari awal bulan ini: {tabTotalDays.total} hari, {tabTotalDays.mondays} Senin, {tabTotalDays.nonMonday} hari nabung.</p>
                </div>

                <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-2">
                  <h3 className="text-sm font-bold text-white">Riwayat Setoran</h3>
                  {savings.length === 0 && <p className="text-xs text-neutral-500">Belum ada setoran.</p>}
                  {savings.slice(0, 30).map(sv => (
                    <div key={sv.id} className="flex justify-between items-center bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs">
                      <span className="text-neutral-400">{sv.date}</span>
                      <span className="flex items-center gap-3">
                        <b className="text-emerald-400">Rp {sv.amount.toLocaleString()}</b>
                        <button onClick={() => handleDeleteSaving(sv)} className="text-red-400"><Trash2 size={14} /></button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. SETTING TAB (EXACTLY MATCHING USER SCREENSHOT) */}
            {activeTab === 'setting' && (
              <div className="space-y-6">
                {settingView === 'main' && (
                  <div className="bg-[#141414] border border-[#262626] rounded-3xl p-6 shadow-2xl space-y-4">
                    <div>
                      <h2 className="text-xl font-black text-white">Pengaturan & Tools</h2>
                      <p className="text-xs text-neutral-400">Kelola data barbershop, tarif layanan & addon, serta keamanan akun Owner.</p>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div 
                        onClick={() => alert('Fitur Data Pelanggan Aktif')}
                        className="p-4 bg-black border border-neutral-800 rounded-2xl flex justify-between items-center cursor-pointer hover:border-amber-500 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Users size={20} className="text-amber-500" />
                          <div>
                            <p className="text-xs font-bold text-white">Lihat Data Pelanggan</p>
                            <p className="text-[10px] text-neutral-400">Aktif (Opsional)</p>
                          </div>
                        </div>
                        <span className="text-neutral-500 font-bold">›</span>
                      </div>

                      <div 
                        onClick={() => setSettingView('kelola_barberman')}
                        className="p-4 bg-black border border-neutral-800 rounded-2xl flex justify-between items-center cursor-pointer hover:border-amber-500 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Scissors size={20} className="text-amber-500" />
                          <div>
                            <p className="text-xs font-bold text-white">Kelola Barberman & Skema Gaji</p>
                            <p className="text-[10px] text-neutral-400">{employees.length} Barberman di cabang ini</p>
                          </div>
                        </div>
                        <span className="text-neutral-500 font-bold">›</span>
                      </div>

                      <div 
                        onClick={() => setActiveTab('services')}
                        className="p-4 bg-black border border-neutral-800 rounded-2xl flex justify-between items-center cursor-pointer hover:border-amber-500 transition"
                      >
                        <div className="flex items-center gap-3">
                          <ShoppingBag size={20} className="text-amber-500" />
                          <div>
                            <p className="text-xs font-bold text-white">Layanan & Tambahan (Addon)</p>
                            <p className="text-[10px] text-neutral-400">{services.length} layanan terdaftar</p>
                          </div>
                        </div>
                        <span className="text-neutral-500 font-bold">›</span>
                      </div>

                      <div 
                        onClick={() => alert('Cabang Utama: Rekap GC Bang All')}
                        className="p-4 bg-black border border-neutral-800 rounded-2xl flex justify-between items-center cursor-pointer hover:border-amber-500 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar size={20} className="text-amber-500" />
                          <div>
                            <p className="text-xs font-bold text-white">Kelola Cabang</p>
                            <p className="text-[10px] text-neutral-400">1 cabang terdaftar</p>
                          </div>
                        </div>
                        <span className="text-neutral-500 font-bold">›</span>
                      </div>

                      <div 
                        onClick={() => alert('Langganan Anda: Selamanya (Free Tier 24/7)')}
                        className="p-4 bg-black border border-neutral-800 rounded-2xl flex justify-between items-center cursor-pointer hover:border-amber-500 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Wallet size={20} className="text-amber-500" />
                          <div>
                            <p className="text-xs font-bold text-white">Langganan</p>
                            <p className="text-[10px] text-neutral-400">Tanpa Batas Waktu (Aktivasi Selamanya)</p>
                          </div>
                        </div>
                        <span className="text-neutral-500 font-bold">›</span>
                      </div>

                      <div 
                        onClick={() => { setWaInput(waNumber); setSettingView('whatsapp'); }}
                        className="p-4 bg-black border border-neutral-800 rounded-2xl flex justify-between items-center cursor-pointer hover:border-amber-500 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Phone size={20} className="text-amber-500" />
                          <div>
                            <p className="text-xs font-bold text-white">No WhatsApp</p>
                            <p className="text-[10px] text-neutral-400">{waNumber}</p>
                          </div>
                        </div>
                        <span className="text-neutral-500 font-bold">›</span>
                      </div>

                      <div 
                        onClick={() => setSettingView('keamanan')}
                        className="p-4 bg-black border border-neutral-800 rounded-2xl flex justify-between items-center cursor-pointer hover:border-amber-500 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Lock size={20} className="text-amber-500" />
                          <div>
                            <p className="text-xs font-bold text-white">Keamanan & Password</p>
                            <p className="text-[10px] text-neutral-400">Kelola kredensial akun Owner</p>
                          </div>
                        </div>
                        <span className="text-neutral-500 font-bold">›</span>
                      </div>

                      <div 
                        onClick={() => alert('Panduan Penggunaan: Gunakan menu Kasir untuk input harian dan Rekap untuk melihat laporan.')}
                        className="p-4 bg-black border border-neutral-800 rounded-2xl flex justify-between items-center cursor-pointer hover:border-amber-500 transition"
                      >
                        <div className="flex items-center gap-3">
                          <HelpCircle size={20} className="text-amber-500" />
                          <div>
                            <p className="text-xs font-bold text-white">Panduan</p>
                            <p className="text-[10px] text-neutral-400">Cara pakai Rekap GC Bang All</p>
                          </div>
                        </div>
                        <span className="text-neutral-500 font-bold">›</span>
                      </div>

                      <div 
                        onClick={() => { setRole(null); setOwnerPinInput(''); }}
                        className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-red-500/20 transition text-red-400"
                      >
                        <div className="flex items-center gap-3">
                          <LogOut size={20} />
                          <div>
                            <p className="text-xs font-bold">Keluar dari Akun Owner</p>
                            <p className="text-[10px] opacity-80">Akhiri sesi Owner di perangkat ini</p>
                          </div>
                        </div>
                        <span>›</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* SUB-VIEW: KELOLA BARBERMAN & SKEMA GAJI (EXACTLY MATCHING USER SCREENSHOT) */}
                {settingView === 'kelola_barberman' && (
                  <div className="bg-[#141414] border border-[#262626] rounded-3xl p-6 shadow-2xl space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                      <button onClick={() => setSettingView('main')} className="text-xs font-bold text-amber-500 hover:underline">
                        ← Kembali
                      </button>
                      <h2 className="text-base font-black text-white">Kelola Barberman & Skema Gaji</h2>
                      <button 
                        onClick={() => setShowAddBarberModal(true)}
                        className="px-3 py-1.5 bg-white text-black font-extrabold rounded-xl text-xs hover:bg-neutral-200"
                      >
                        + Tambah
                      </button>
                    </div>

                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-[11px] text-blue-300 leading-relaxed">
                      ✨ Perubahan skema cuma berlaku untuk transaksi baru, data lama tetap aman. Perubahan Barberman dan setelan pendapatan di bawah otomatis masuk ke Kasir paling lama 2 menit.
                    </div>

                    <div className="p-4 bg-black border border-neutral-800 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-white">Barberman bisa melihat pendapatan Barberman lain di halaman Kasir</p>
                          <p className="text-[10px] text-neutral-400">Jika dimatikan, Barberman hanya bisa melihat jumlah kepala dan layanan tiap Barberman, tanpa nominal Rp.</p>
                        </div>
                        <button 
                          onClick={toggleCanViewOtherEarnings}
                          className={`w-12 h-6 flex items-center rounded-full p-1 transition ${canViewOtherEarnings ? 'bg-amber-500 justify-end' : 'bg-neutral-800 justify-start'}`}
                        >
                          <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
                        </button>
                      </div>
                    </div>

                    {/* Barberman List Cards */}
                    <div className="space-y-3">
                      {employees.map((emp, idx) => (
                        <div key={emp.name} className="p-4 bg-black border border-neutral-800 rounded-2xl space-y-3">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full ${emp.active ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                              <span className="font-black text-white uppercase text-sm">{emp.name}</span>
                              <span className="px-2 py-0.5 bg-neutral-800 text-[10px] text-neutral-300 rounded font-bold">Owner</span>
                            </div>
                            <span className="font-mono text-xs font-bold text-amber-400">{emp.ratio}</span>
                          </div>

                          <div className="flex gap-2 pt-2 border-t border-neutral-900">
                            <button onClick={() => handleEditRatio(idx)} className="flex-1 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                              <Edit2 size={13} /> Edit Skema
                            </button>
                            <button onClick={() => toggleBarberActive(idx)} className="flex-1 py-2 bg-neutral-900 hover:bg-neutral-800 text-amber-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                              <RefreshCw size={13} /> {emp.active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button onClick={() => deleteBarber(idx)} className="p-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ADD BARBER MODAL */}
                {showAddBarberModal && (
                  <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#141414] border border-amber-500/40 rounded-3xl p-6 max-w-sm w-full space-y-4">
                      <h3 className="text-base font-black text-white">Tambah Kapster / Barberman</h3>
                      <form onSubmit={handleAddBarber} className="space-y-3">
                        <div>
                          <label className="block text-xs text-neutral-400 mb-1">Nama Kapster:</label>
                          <input 
                            type="text" 
                            value={newBarberName}
                            onChange={(e) => setNewBarberName(e.target.value)}
                            placeholder="Contoh: Budi"
                            className="w-full bg-black border border-neutral-700 rounded-xl p-3 text-xs text-white outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-neutral-400 mb-1">Skema Bagi Hasil (Cth: 60/40):</label>
                          <input 
                            type="text" 
                            value={newBarberRatio}
                            onChange={(e) => setNewBarberRatio(e.target.value)}
                            className="w-full bg-black border border-neutral-700 rounded-xl p-3 text-xs text-white outline-none"
                            required
                          />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button type="submit" className="flex-1 py-3 bg-amber-500 text-black font-extrabold rounded-xl text-xs">Simpan</button>
                          <button type="button" onClick={() => setShowAddBarberModal(false)} className="flex-1 py-3 bg-neutral-900 text-neutral-400 font-bold rounded-xl text-xs">Batal</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {settingView === 'whatsapp' && (
                  <div className="bg-[#141414] border border-[#262626] rounded-3xl p-6 space-y-4">
                    <button onClick={() => setSettingView('main')} className="text-xs font-bold text-amber-500">← Kembali</button>
                    <h3 className="text-base font-bold text-white">Nomor WhatsApp Penerima Laporan</h3>
                    <input type="text" value={waInput} onChange={(e) => setWaInput(e.target.value)} className="w-full bg-black border border-neutral-700 rounded-xl p-3 text-xs text-white" />
                    <button onClick={handleSaveWaNumber} className="w-full py-3 bg-amber-500 text-black font-bold rounded-xl text-xs">Simpan</button>
                  </div>
                )}

                {settingView === 'keamanan' && (
                  <div className="bg-[#141414] border border-[#262626] rounded-3xl p-6 space-y-4">
                    <button onClick={() => setSettingView('main')} className="text-xs font-bold text-amber-500">← Kembali</button>
                    <h3 className="text-base font-bold text-white">Keamanan & Password Owner</h3>
                    <input 
                      type="password" 
                      id="newPinInput"
                      placeholder="PIN Baru (4-6 digit)" 
                      className="w-full bg-black border border-neutral-700 rounded-xl p-3 text-xs text-white outline-none text-center tracking-[1em] font-bold text-amber-500 text-lg" 
                      maxLength="6"
                    />
                    <button 
                      onClick={handleChangePin} 
                      className="w-full py-3 bg-amber-500 text-black font-bold rounded-xl text-xs"
                    >
                      Perbarui PIN
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* SALARY SLIP MODAL FOR OWNER */}
        {slipModalEmp && (() => {
          const stats = getEmployeeStatsForRange(slipModalEmp.name, selectedDate, gajiFilter);
          const ratioParts = slipModalEmp.ratio.split('/');
          const percentage = parseFloat(ratioParts[0]) || 60;
          const baseSalary = (stats.total * percentage) / 100;
          const bonNum = parseFloat(slipBon) || 0;
          const mealNum = parseFloat(slipMeal) || 0;
          const netSalary = baseSalary - bonNum + mealNum;

          return (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-[#141414] border border-amber-500/40 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl my-auto">
                <div className="text-center space-y-1 border-b border-neutral-800 pb-4">
                  <h3 className="text-lg font-black uppercase text-amber-400">SLIP GAJI & BAGI HASIL</h3>
                  <p className="text-xs text-neutral-400">REKAP GC BANG ALL</p>
                  <p className="text-[11px] text-neutral-500">Periode: {selectedDate}</p>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-neutral-900">
                    <span className="text-neutral-400">Nama Kapster:</span>
                    <span className="font-bold text-white uppercase">{slipModalEmp.name} (Skema: {slipModalEmp.ratio})</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-900">
                    <span className="text-neutral-400">Jumlah Kepala:</span>
                    <span className="font-bold text-amber-400">{stats.count} Kepala</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-900">
                    <span className="text-neutral-400">Total Omset:</span>
                    <span className="font-black text-white">Rp {stats.total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-900">
                    <span className="text-neutral-400">Komisi Bagi Hasil ({slipModalEmp.ratio}):</span>
                    <span className="font-black text-amber-400">Rp {baseSalary.toLocaleString()}</span>
                  </div>

                  <div className="pt-2">
                    <label className="block text-neutral-400 mb-1">Potongan Bon / Kasbon (Rp):</label>
                    <input 
                      type="number"
                      value={slipBon}
                      onChange={(e) => setSlipBon(e.target.value)}
                      placeholder="0"
                      className="w-full bg-black border border-neutral-700 rounded-xl p-2.5 text-xs text-red-400 font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-400 mb-1">Uang Makan / Saku (Rp):</label>
                    <input 
                      type="number"
                      value={slipMeal}
                      onChange={(e) => setSlipMeal(e.target.value)}
                      placeholder="0"
                      className="w-full bg-black border border-neutral-700 rounded-xl p-2.5 text-xs text-emerald-400 font-bold outline-none"
                    />
                  </div>

                  <div className="flex justify-between py-3 bg-black px-4 rounded-xl border border-amber-500/30 mt-3 items-center">
                    <div>
                      <span className="text-neutral-400 block text-[10px]">GAJI BERSIH AKHIR</span>
                      <span className="text-white font-black text-sm">TOTAL DITERIMA</span>
                    </div>
                    <span className="font-black text-amber-400 text-lg">Rp {netSalary.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button 
                    onClick={() => sendSalarySlipWA(slipModalEmp, stats, bonNum, mealNum, netSalary)}
                    className="py-3 bg-[#25D366] text-black font-extrabold rounded-xl hover:bg-[#20ba59] transition text-xs flex items-center justify-center gap-1.5 shadow-lg"
                  >
                    <Share2 size={14} /> Kirim WA
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="py-3 bg-amber-500 text-black font-extrabold rounded-xl hover:bg-amber-400 transition text-xs flex items-center justify-center gap-1.5 shadow-lg"
                  >
                    <Printer size={15} /> Cetak
                  </button>
                </div>
                
                <button 
                  onClick={() => setSlipModalEmp(null)}
                  className="w-full py-2.5 bg-neutral-900 text-neutral-400 font-bold rounded-xl hover:bg-neutral-800 transition text-xs"
                >
                  Tutup
                </button>
              </div>
            </div>
          );
        })()}

        {/* SERVICES MANAGEMENT */}
        {activeTab === 'services' && role === 'owner' && (
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                <ShoppingBag size={18} /> Kelola Layanan & Tambahan
              </h2>
              <button onClick={() => setSettingView('main')} className="text-xs font-bold text-amber-500">← Kembali ke Setting</button>
            </div>
            <form onSubmit={handleAddService} className="flex gap-3 flex-wrap md:flex-nowrap">
              <input name="serviceName" type="text" placeholder="Nama Layanan" className="flex-1 bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white" required />
              <input name="servicePrice" type="number" placeholder="Harga (Rp)" className="w-full md:w-32 bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white" required />
              <button type="submit" className="px-6 py-3 bg-amber-500 text-black font-bold rounded-xl w-full md:w-auto">Tambah</button>
            </form>
            <div className="divide-y divide-neutral-900 border-t border-neutral-800 pt-4">
              {services.length === 0 ? <p className="text-neutral-500 text-sm py-2">Belum ada layanan.</p> :
                services.map(srv => (
                <div key={srv.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">{srv.name}</p>
                    <p className="text-xs text-amber-500">Rp {srv.price?.toLocaleString()}</p>
                  </div>
                  <button onClick={() => handleDeleteService(srv.id)} className="p-2 bg-red-600/20 text-red-400 rounded-xl">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* KALKULATOR (tombol melayang) */}
      {role && (
        <>
          <button
            onClick={() => setShowCalc(v => !v)}
            aria-label="Kalkulator"
            className="fixed right-4 bottom-24 z-[60] w-11 h-11 rounded-full bg-amber-500 text-black shadow-xl flex items-center justify-center"
          >
            <Calculator size={22} />
          </button>
          {showCalc && (
            <div className="fixed right-4 bottom-40 z-[60] w-64 bg-[#141414] border border-[#262626] rounded-2xl p-3 shadow-2xl space-y-2">
              <div className="bg-black border border-neutral-800 rounded-xl px-3 py-3 text-right">
                <p className="text-[10px] text-neutral-500 h-3">{calcPrev !== null ? `${calcShow(calcFmt(calcPrev))} ${calcOp}` : ''}</p>
                <p className="text-2xl font-black text-white break-all">{calcShow(calcDisplay)}</p>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {['C','⌫','%','÷','7','8','9','×','4','5','6','-','1','2','3','+','0','.','='].map(k => (
                  <button
                    key={k}
                    onClick={() => calcPress(k)}
                    className={`py-3 rounded-xl text-sm font-bold ${k === '=' ? 'col-span-2 bg-amber-500 text-black' : ['÷','×','-','+'].includes(k) ? 'bg-amber-500/20 text-amber-400' : ['C','⌫','%'].includes(k) ? 'bg-neutral-700 text-white' : 'bg-black text-white border border-neutral-800'}`}
                  >
                    {k === '.' ? ',' : k}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* OWNER BOTTOM NAVIGATION BAR (MATCHING SCREENSHOT EXACTLY) */}
      {/* ========================================================= */}
      {role === 'owner' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-[#141414] border-t border-[#262626] py-2 px-3 flex justify-around items-center z-50">
          <button 
            onClick={() => setActiveTab('pos')} 
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'pos' ? 'text-amber-500 font-bold' : 'text-neutral-400 hover:text-white'}`}
          >
            <Calendar size={20} />
            <span className="text-[10px]">Hari Ini</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('kas')} 
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'kas' ? 'text-amber-500 font-bold' : 'text-neutral-400 hover:text-white'}`}
          >
            <Wallet size={20} />
            <span className="text-[10px]">Kas</span>
          </button>

          <button 
            onClick={() => setActiveTab('tabungan')} 
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'tabungan' ? 'text-amber-500 font-bold' : 'text-neutral-400 hover:text-white'}`}
          >
            <Banknote size={20} />
            <span className="text-[10px]">Tabungan</span>
          </button>

          <button 
            onClick={() => setActiveTab('gaji')} 
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'gaji' ? 'text-amber-500 font-bold' : 'text-neutral-400 hover:text-white'}`}
          >
            <Users size={20} />
            <span className="text-[10px]">Gaji</span>
          </button>

          <button 
            onClick={() => setActiveTab('recap')} 
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'recap' ? 'text-amber-500 font-bold' : 'text-neutral-400 hover:text-white'}`}
          >
            <TrendingUp size={20} />
            <span className="text-[10px]">Rekap</span>
          </button>

          <button 
            onClick={() => { setActiveTab('setting'); setSettingView('main'); }} 
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'setting' ? 'text-amber-500 font-bold' : 'text-neutral-400 hover:text-white'}`}
          >
            <Settings size={20} />
            <span className="text-[10px]">Setting</span>
          </button>
        </nav>
      )}
    </div>
  );
}


/* Tambahan Fitur Gaji & Notif v41 terintegrasi */