import React, { useState, useEffect, } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- 1. 基礎樣式與圖標設定 ---
const mapContainerStyle = {
  height: "350px",
  width: "100%",
  position: "relative"
};


// 1. 定義使用者位置圖標 (標準藍色)
const userIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color:#3B82F6; width:15px; height:15px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.3);"></div>`,
  iconSize: [15, 15],
  iconAnchor: [7, 7]
});

// 2. 定義司機位置 (綠色圖標)
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
  iconAnchor: [18, 36],
  popupAnchor: [0, -36]
});

// --- 2. 模擬數據 ---
const MOCK_DRIVERS = [
  { id: 1, name: "阿強專業拖吊", phone: "0912345678", lat: 25.0330, lng: 121.5654, price: 1500, rating: 4.8, type: "全載/吊桿" },
  { id: 2, name: "大台北救援王", phone: "0987654321", lat: 25.0400, lng: 121.5700, price: 1200, rating: 4.5, type: "一般拖吊" },
  { id: 3, name: "誠信道路救援", phone: "0900111222", lat: 25.0250, lng: 121.5550, price: 1600, rating: 4.9, type: "全載" },
];

// --- 3. 地圖控制組件 (解決地圖亂跑的核心) ---
function MapController({ userLoc, targetLoc }) {
  const map = useMap();
  
  useEffect(() => {
    // 如果有目標位置(點擊司機或點擊定位按鈕)，地圖就滑過去
    if (targetLoc) {
      map.flyTo([targetLoc.lat, targetLoc.lng], 15, { duration: 1.2 });
    }
  }, [targetLoc, map]);

  return null;
}

const App = () => {
  // --- 4. 狀態管理 ---
  const [userLoc, setUserLoc] = useState(null); // 我的位置
  const [targetLoc, setTargetLoc] = useState(null); // 地圖目前要滑向的目標
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drivers, ] = useState(MOCK_DRIVERS);
  const [logs, setLogs] = useState([]); // 簡易 Log 紀錄

  // --- 5. 簡易 Log 機制 (存於瀏覽器，不花錢) ---
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

  // --- 7. 點擊司機處理 ---
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
          <h1 className="text-xl font-bold">公道拖吊媒合站</h1>
          <button onClick={reportError} className="text-xs bg-red-500 px-2 py-1 rounded">報修</button>
        </div>
        <p className="text-xs opacity-80 mt-1">遇到糾紛？點擊報修回報給管理員</p>
      </header>

      {/* 地圖區 */}
      <div style={mapContainerStyle} className="z-0">
        <MapContainer center={[userLoc.lat, userLoc.lng]} zoom={14} style={{ height: '100%', width: '100%' }}>
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
        <h2 className="p-2 font-bold text-gray-600 text-sm">附近在線司機 ({drivers.length})</h2>
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

export default App;
