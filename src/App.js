// --- 1. 所有的 Import (包含 Firebase) ---
import React, { useState, useEffect, } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update } from "firebase/database";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- 2. Firebase 設定 (放在組件外面，只初始化一次) ---
const firebaseConfig = {
  apiKey: "AIzaSyCcXEB4nS7ApHK4-5le0iLaZMOqAyFr1rs",
  authDomain: "taipei-tow.firebaseapp.com",
  databaseURL: "https://taipei-tow-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "taipei-tow",
  storageBucket: "taipei-tow.firebasestorage.app",
  messagingSenderId: "879808326400",
  appId: "1:879808326400:web:9db0a593acd7ea9b9561e5",
  measurementId: "G-KN4PEWD91E"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
console.log("讀取firebase app:"+app);
console.log("讀取firebase db:"+db);
// --- 3.  Icon 定義與樣式 (SVG 那些) ---
const mapContainerStyle = {
  height: "350px",
  width: "100%",
  position: "relative"
};


// 3.1定義使用者位置圖標 (標準藍色)
const userIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color:#3B82F6; width:15px; height:15px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.3);"></div>`,
  iconSize: [15, 15],
  iconAnchor: [7, 7]
});

// 3.2定義司機位置 (綠色圖標)
const driverIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
         xmlns="http://www.w3.org/2000/svg">
      <!-- 車身 -->
      <rect x="3" y="10" width="18" height="6" rx="2"
        fill="#1341bf" stroke="white" stroke-width="1.5"/>
      <!-- 車頂 -->
      <path d="M7 10L9 6H15L17 10Z"
        fill="#10b921" stroke="white" stroke-width="1.5"/>
      <!-- 輪子 -->
      <circle cx="7" cy="17" r="2" fill="black"/>
      <circle cx="17" cy="17" r="2" fill="black"/>
    </svg>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18]
});

// --- 2. 模擬數據 ---
const MOCK_DRIVERS = [
  { id: 1, name: "阿強專業拖吊", phone: "0912345678", lat: 25.0330, lng: 121.5654, price: 1500, rating: 4.8, type: "全載/吊桿" },
  { id: 2, name: "大台北救援王", phone: "0987654321", lat: 25.0400, lng: 121.5700, price: 1200, rating: 4.5, type: "一般拖吊" },
  { id: 3, name: "誠信道路救援", phone: "0900111222", lat: 25.0250, lng: 121.5550, price: 1600, rating: 4.9, type: "全載" },
];

// --- 3.3地圖控制組件 (解決地圖亂跑的核心) ---
function MapController({ userLoc, targetLoc }) {
  const map = useMap();
  
  useEffect(() => {
    // 如果有目標位置(點擊司機或點擊定位按鈕)，地圖就滑過去
    if (targetLoc) {
      map.invalidateSize();
      map.flyTo([targetLoc.lat, targetLoc.lng], 15, { duration: 1.2 });
    }
  }, [targetLoc, map]);
useEffect(() => {
    setTimeout(() => {
      map.invalidateSize(); 
    }, 100);
  }, [map]);
  return null;
}

// --- 4. 主組件 App ---
const App = () => {
  // --- 4. 狀態管理 ---
  // A. 狀態定義 (加上 viewMode)
  const [viewMode, setViewMode] = useState('user'); // user, register, driver_panel
  const [onlineDrivers, setOnlineDrivers] = useState([]); // 從資料庫讀取的司機
  const [myDriverId, setMyDriverId] = useState(localStorage.getItem('my_driver_id'));


  const [userLoc, setUserLoc] = useState(null); // 我的位置
  const [targetLoc, setTargetLoc] = useState(null); // 地圖目前要滑向的目標
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drivers, ] = useState(MOCK_DRIVERS);
  const [logs, setLogs] = useState([]); // 簡易 Log 紀錄

  // --- 簡易 Log 機制 (存於瀏覽器，不花錢) ---
  const addLog = (message) => {
    const newLog = `${new Date().toLocaleTimeString()}: ${message}`;
    console.log(newLog);
    setLogs(prev => [newLog, ...prev].slice(0, 10)); // 只保留最近 10 條
  };

  // --- 6. 初始化與定位 ---
  useEffect(() => {
    addLog("啟動程式中...");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLoc(loc);
          setTargetLoc(loc); // 初始目標設為自己
          setLoading(false);
          addLog("定位成功");
        },
        (err) => {
          addLog("定位失敗: " + err.message);
          setUserLoc({ lat: 25.0339, lng: 121.5645 }); // 預設台北
          setLoading(false);
        }
      );
    }
  }, []);
   // C. Firebase 監聽 useEffect (新增的)
  // --- 駕駛視角：即時監聽資料庫中 線上的拖車司機 ---
  useEffect(() => {
    const driversRef = ref(db, 'drivers');
    onValue(driversRef, (snapshot) => {
      const data = snapshot.val();
      console.log("讀取拖車司機資料:" + data);
      if (data) {
        // 轉為陣列並過濾「待命中 (online)」的司機
        const list = Object.entries(data)
          .map(([id, val]) => ({ id, ...val }))
          .filter(d => d.status === 'online');
        setOnlineDrivers(list);
      }
    });
  }, [onlineDrivers]);

 
 // --- 司機註冊功能 ---
  const handleRegister = async (formData) => {
    const newId = 'DRV' + Date.now();
    const newDriver = {
      ...formData,
      status: 'offline', // 初始下工
      rating: 5.0,
      lat: userLoc.lat,
      lng: userLoc.lng
    };
      try {
        console.log("寫入資料庫 id:"+newId+", 拖車司機: "+newDriver);
        await set(ref(db, `drivers/${newId}`), newDriver);
        console.log("寫入資料庫成功");
        addLog("資料庫寫入成功");
        // 模擬寄信：實務上可用 EmailJS (免費) 或簡單跳通知
        console.log("系統已發送註冊通知給管理員"); 
        localStorage.setItem('my_driver_id', newId);
        setMyDriverId(newId);
        setViewMode('driver_panel');
      }catch(error) {
        console.error("寫入失敗:", error);
        alert("註冊失敗，請檢查網路");
      }
  };

  // --- 司機更新狀態/價格 ---
  // const toggleStatus = (currentStatus) => {
  //   const newStatus = currentStatus === 'online' ? 'offline' : 'online';
  //   update(ref(db, `drivers/${myDriverId}`), { 
  //     status: newStatus,
  //     lat: userLoc.lat, // 更新當前位置
  //     lng: userLoc.lng 
  //   });
  // };

// D. 輔助組件 (將之前的地圖與列表包裝起來，方便切換畫面)
  // const UserView = () => (
  //   <div className="flex flex-col h-screen">
  //      {/* 這裡放你原本 return 裡面的地圖、司機列表、Header */}
  //      {/* 注意：這裡要改用 onlineDrivers 而不是 MOCK_DRIVERS */}
  //   </div>
  // );

  // E. 畫面切換邏輯 (核心控制)
   if (viewMode === 'register') {
    return <RegisterForm onCancel={() => setViewMode('user')} onSubmit={handleRegister} />;
  }

  if (viewMode === 'driver_panel') {
    return <DriverPanel driverId={myDriverId} onExit={() => setViewMode('user')} />;
  }


  // ---點擊司機處理 ---
  const handleSelectDriver = (driver) => {
    setSelectedDriver(driver);
    setTargetLoc({ lat: driver.lat, lng: driver.lng }); // 更新地圖目標
    addLog(`選擇司機: ${driver.name}`);
    
    // 列表自動捲動
    const element = document.getElementById(`driver-${driver.id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // --- 8. 回報錯誤功能 ---
  const reportError = () => {
    // const emailBody = `問題描述: \n\n 最近日誌: \n${logs.join('\n')}`;
    window.location.href = `mailto:admin@://example.com{encodeURIComponent(emailBody)}`;
  };

  //Log 儲存 User ID
  // 在 App 組件內部
  // const [userId] = useState(() => {
  //   let id = localStorage.getItem('tow_user_id');
  //   if (!id) {
  //     id = 'User_' + Math.random().toString(36).substr(2, 9);
  //     localStorage.setItem('tow_user_id', id);
  //   }
  //   return id;
  // });
  if (loading) return <div className="h-screen flex items-center justify-center">正在確認您的位置...</div>;

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-50 shadow-xl overflow-hidden relative">
      
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 z-10 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">台北找拖吊</h1>
          <button onClick={reportError} className="text-xs bg-red-500 px-2 py-1 rounded">報修</button>
          <button onClick={() => setViewMode(myDriverId ? 'driver_panel' : 'register')} className="bg-white text-blue-600 px-2 py-1 rounded text-xs font-bold">
          {myDriverId ? "司機管理" : "司機加入"}
        </button>
        </div>
        <p className="text-xs opacity-80 mt-1">遇到糾紛？點擊報修回報給管理員</p>
      </header>

      {/* 地圖區 */}
      <div style={mapContainerStyle} className="z-0">
        <MapContainer center={[userLoc.lat, userLoc.lng]} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {/* 我的位置 */}
          <Marker position={[userLoc.lat, userLoc.lng]} icon={userIcon}>
            <Popup>您的故障地點</Popup>
          </Marker>

          {/* 司機位置 */}
          {drivers.map(driver => (
            <Marker 
              key={driver.id} 
              position={[driver.lat, driver.lng]} 
              icon={driverIcon} // 確保這裡帶入綠色圖標
              eventHandlers={{ click: () => handleSelectDriver(driver) }}
            >
              <Popup><b>{driver.name}</b></Popup>
            </Marker>
          ))}

          {/* 地圖控制器：只根據 targetLoc 變動滑動 */}
          <MapController userLoc={userLoc} targetLoc={targetLoc} />
        </MapContainer>

        {/* 核心功能：快速回到我的位置按鈕 */}
        <button 
          onClick={() => {
            setTargetLoc(userLoc);
            setSelectedDriver(null);
            addLog("用戶點擊回定位按鈕");
          }}
          className="absolute bottom-4 right-4 z-[1000] bg-white p-3 rounded-full shadow-lg border border-gray-200 active:bg-gray-100"
        >
          📍 定位我
        </button>
      </div>

      {/* 司機列表區 */}
      <div className="flex-1 overflow-y-auto p-2">
        <h2 className="p-2 font-bold text-gray-600 text-sm">附近線上司機 ({drivers.length})</h2>
        {drivers.map(driver => (
          <div 
            key={driver.id} 
            id={`driver-${driver.id}`}
            onClick={() => handleSelectDriver(driver)}
            className={`bg-white m-2 p-4 rounded-xl border-2 transition-all ${selectedDriver?.id === driver.id ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-transparent'}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-gray-800">{driver.name}</div>
                <div className="text-xs text-red-500 font-bold mt-1">起拖價：${driver.price}</div>
                <div className="text-[10px] text-gray-400 mt-1">評分：★ {driver.rating} | 類型：{driver.type}</div>
              </div>
              <a href={`tel:${driver.phone}`} className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm">撥號</a>
            </div>
          </div>
        ))}

        {/* 預留廣告位 */}
        <div className="m-4 p-10 border-2 border-dashed border-gray-300 rounded-xl bg-gray-100 text-gray-400 text-center text-sm">
          這裡預留廣告空間 (例如：合作修車廠)
          <br />
          <span className="text-[10px]">廣告聯繫：09XX-XXX-XXX</span>
        </div>
      </div>

      {/* 頁腳日誌 (Debug 用) */}
      <footer className="p-2 bg-gray-200 text-[9px] text-gray-500 font-mono">
        Debug Logs: {logs[0] || "無日誌"}
      </footer>
    </div>
  );
};

const RegisterForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    price: 1500,
    type: '一般拖吊',
    note: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return alert("請填寫基本資料");
    onSubmit(formData);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 p-6 overflow-y-auto">
      <h2 className="text-2xl font-bold text-blue-600 mb-2">加入拖吊司機</h2>
      <p className="text-gray-500 text-sm mb-6">填寫後管理員將進行審核，審核通過即可上工。</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold mb-1">司機名稱 / 車行名稱 *</label>
          <input type="text" required className="w-full p-3 border rounded-xl" placeholder="例：阿強專業拖吊"
            onChange={e => setFormData({...formData, name: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">聯絡電話 *</label>
          <input type="tel" required className="w-full p-3 border rounded-xl" placeholder="例：0912345678"
            onChange={e => setFormData({...formData, phone: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">起拖參考價 (10km內)</label>
          <input type="number" className="w-full p-3 border rounded-xl" value={formData.price}
            onChange={e => setFormData({...formData, price: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">設備類型</label>
          <select className="w-full p-3 border rounded-xl bg-white" 
            onChange={e => setFormData({...formData, type: e.target.value})}>
            <option>一般拖吊</option>
            <option>全載/吊桿</option>
            <option>超跑低底盤專用</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">備註資訊</label>
          <textarea className="w-full p-3 border rounded-xl" placeholder="例：夜間需加收 300 元"
            onChange={e => setFormData({...formData, note: e.target.value})} />
        </div>
        
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onCancel} className="flex-1 p-4 bg-gray-200 rounded-xl font-bold">取消</button>
          <button type="submit" className="flex-2 p-4 bg-blue-600 text-white rounded-xl font-bold px-8">提交申請</button>
        </div>
      </form>
    </div>
  );
};
const DriverPanel = ({ driverId, onExit }) => {
  const [myInfo, setMyInfo] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // 實時監聽自己的資料
  useEffect(() => {
    const myRef = ref(db, `drivers/${driverId}`);
    const unsubscribe = onValue(myRef, (snapshot) => {
      const data = snapshot.val();
      console.log("正在讀取司機資料:", data); // 加上這行來 Debug
      if (data) {
        setMyInfo(data);
      } else {
        console.error("找不到該 ID 的資料:", driverId);
      }
    });
    return () => unsubscribe();
  }, [driverId, isUpdating]);

  const handleUpdate = async (updates) => {
    setIsUpdating(true);
    await update(ref(db, `drivers/${driverId}`), updates);
    setIsUpdating(false);
  };

  if (!myInfo) return <div className="p-10 text-center">讀取司機資料中...</div>;

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="bg-green-600 p-6 text-white text-center shadow-lg">
        <h2 className="text-xl font-bold">司機工作台</h2>
        <p className="text-sm opacity-80">{myInfo.name}</p>
      </header>

      <div className="flex-1 p-6 space-y-8">
        {/* 狀態切換大按鈕 */}
        <div className="text-center">
          <label className="block text-gray-500 text-sm mb-2">目前接單狀態</label>
          <button 
            onClick={() => handleUpdate({ status: myInfo.status === 'online' ? 'offline' : 'online' })}
            className={`w-full py-8 rounded-3xl text-2xl font-black shadow-xl transition-all active:scale-95 ${
              myInfo.status === 'online' ? 'bg-green-500 text-white border-b-8 border-green-700' : 'bg-gray-200 text-gray-500 border-b-8 border-gray-300'
            }`}
          >
            {myInfo.status === 'online' ? "🟢 待命接單中" : "⚪️ 休息下工中"}
          </button>
        </div>

        {/* 價格與備註快速修改 */}
        <div className="space-y-4 bg-gray-50 p-4 rounded-2xl">
          <div>
            <label className="text-xs font-bold text-gray-400">目前起拖價</label>
            <input type="number" className="w-full text-xl font-bold bg-transparent border-b border-gray-300 focus:outline-none" 
              defaultValue={myInfo.price} onBlur={(e) => handleUpdate({ price: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400">更新備註</label>
            <textarea className="w-full text-sm bg-transparent border-b border-gray-300 focus:outline-none" 
              defaultValue={myInfo.note} onBlur={(e) => handleUpdate({ note: e.target.value })} />
          </div>
        </div>
      </div>

      <footer className="p-6 border-t flex flex-col gap-2">
        <button onClick={onExit} className="w-full p-4 bg-blue-100 text-blue-700 rounded-xl font-bold">返回地圖查看</button>
        <p className="text-[10px] text-center text-gray-400">更新後地圖會即時同步給所有駕駛</p>
      </footer>
    </div>
  );
};

export default App;
