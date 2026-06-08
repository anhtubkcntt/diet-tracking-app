import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// TODO: Thay bằng Web App URL do user cung cấp
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzlYwq4lKUJz4f6B5GYAsfM-JB2X2izkGsVjEvgO6QhIDPM3bAQ_cqyYtRVb8NW_3jnVg/exec';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

function App() {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [goal, setGoal] = useState(2000); // Tạm đặt mục tiêu 2000 kcal
  const [formData, setFormData] = useState({ name: '', calories: '', mealType: 'Sáng' });

  // Lấy dữ liệu từ Google Sheets
  const fetchMeals = async () => {
    if (!WEB_APP_URL) return;
    setLoading(true);
    try {
      const response = await fetch(`${WEB_APP_URL}?t=${Date.now()}`);
      const data = await response.json();
      setMeals(data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMeals();
  }, []);

  // Tính toán dữ liệu 7 ngày gần nhất
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toLocaleDateString('vi-VN');
      
      const dailyMeals = meals.filter(meal => {
        if (!meal.date) return false;
        return new Date(meal.date).toLocaleDateString('vi-VN') === dateString;
      });
      
      const dailyCalories = dailyMeals.reduce((sum, meal) => sum + Number(meal.calories || 0), 0);
      
      let label = `${d.getDate()}/${d.getMonth() + 1}`;
      if (i === 0) label = "Hôm nay";
      
      data.push({
        name: label,
        calo: dailyCalories
      });
    }
    return data;
  }, [meals]);

  // Lấy danh sách bữa ăn của "hôm nay"
  const todayString = new Date().toLocaleDateString('vi-VN');
  const todayMeals = meals.filter(meal => {
    if (!meal.date) return false;
    return new Date(meal.date).toLocaleDateString('vi-VN') === todayString;
  });

  const totalCalories = todayMeals.reduce((sum, meal) => sum + Number(meal.calories || 0), 0);
  const progressPercent = Math.min((totalCalories / goal) * 100, 100);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    try {
      // Đọc file thành base64
      const base64String = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });

      // Bỏ đi đoạn prefix 'data:image/jpeg;base64,'
      const base64Data = base64String.split(',')[1];
      const mimeType = file.type;

      // Gọi Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Bạn là chuyên gia dinh dưỡng. Hãy nhìn bức ảnh này, xác định tên món ăn và ước lượng số Calo của nó. Phản hồi của bạn CHỈ ĐƯỢC CHỨA ĐÚNG 1 CHUỖI JSON, KHÔNG có định dạng markdown, KHÔNG có chữ nào khác ngoài JSON. Ví dụ: {\"name\": \"Phở bò\", \"calories\": 450}" },
              { inline_data: { mime_type: mimeType, data: base64Data } }
            ]
          }]
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      let resultText = data.candidates[0].content.parts[0].text;
      
      // Tìm đúng đoạn text nằm trong ngoặc nhọn {} để tránh AI nói nhảm thêm chữ
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Không tìm thấy JSON hợp lệ từ AI");
      
      const aiResult = JSON.parse(jsonMatch[0]);
      
      setFormData({
        ...formData,
        name: aiResult.name || '',
        calories: aiResult.calories || ''
      });
      alert(`AI đã nhận diện: ${aiResult.name} (~${aiResult.calories} Calo)`);

    } catch (error) {
      console.error('Lỗi nhận diện ảnh:', error);
      alert('Không thể nhận diện ảnh. Vui lòng thử lại!');
    }
    setIsScanning(false);
    // Reset ô input file để có thể chọn lại cùng 1 ảnh
    e.target.value = null;
  };

  const handleAddMeal = async (e) => {
    e.preventDefault();
    if (!WEB_APP_URL) {
      alert("Đang đợi cấu hình Google Web App URL!");
      return;
    }
    
    setLoading(true);
    const newMeal = {
      id: Date.now().toString(), // Tạo ID đơn giản
      name: formData.name,
      calories: formData.calories,
      mealType: formData.mealType,
      date: new Date().toISOString()
    };

    try {
      await fetch(WEB_APP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(newMeal)
      });
      setFormData({ name: '', calories: '', mealType: 'Sáng' });
      fetchMeals();
    } catch (error) {
      console.error("Error adding meal:", error);
      alert("Có lỗi xảy ra khi thêm dữ liệu!");
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!WEB_APP_URL) return;
    setLoading(true);
    try {
      await fetch(WEB_APP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'DELETE', id })
      });
      fetchMeals();
    } catch (error) {
      console.error("Error deleting meal:", error);
    }
    setLoading(false);
  };

  return (
    <div className="app-container">
      <div className="glass-card">
        <h1 className="title">🍏 Diet Tracker</h1>
        
        <div className="dashboard-stats">
          <div className="stat-item">
            <div className="stat-label">Đã ăn</div>
            <div className="stat-value">{totalCalories} <span style={{fontSize:'1rem'}}>kcal</span></div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Mục tiêu</div>
            <div className="stat-value">{goal} <span style={{fontSize:'1rem'}}>kcal</span></div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Còn lại</div>
            <div className="stat-value" style={{color: totalCalories > goal ? 'var(--danger-color)' : ''}}>
              {goal - totalCalories} <span style={{fontSize:'1rem'}}>kcal</span>
            </div>
          </div>
        </div>

        <div className="progress-bar-bg">
          <div 
            className="progress-bar-fill" 
            style={{ 
              width: `${progressPercent}%`,
              backgroundColor: progressPercent >= 100 ? 'var(--danger-color)' : 'var(--primary-color)'
            }}
          ></div>
        </div>
      </div>

      <div className="glass-card">
        <h2 style={{marginBottom: '1rem'}}>Thêm bữa ăn</h2>
        <form onSubmit={handleAddMeal}>
          <div className="input-group">
            <label>Tên món</label>
            <input 
              type="text" 
              required 
              placeholder="Vd: Phở bò" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          
          <div style={{display: 'flex', gap: '1rem'}}>
            <div className="input-group" style={{flex: 1}}>
              <label>Calo (kcal)</label>
              <input 
                type="number" 
                required 
                placeholder="Vd: 400" 
                value={formData.calories}
                onChange={e => setFormData({...formData, calories: e.target.value})}
              />
            </div>
            
            <div className="input-group" style={{flex: 1}}>
              <label>Bữa ăn</label>
              <select 
                value={formData.mealType}
                onChange={e => setFormData({...formData, mealType: e.target.value})}
              >
                <option value="Sáng">Sáng</option>
                <option value="Trưa">Trưa</option>
                <option value="Tối">Tối</option>
                <option value="Ăn vặt">Ăn vặt</option>
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <button type="submit" className="btn" style={{width: '100%'}} disabled={loading || !WEB_APP_URL}>
              {loading ? 'Đang lưu...' : '+ Thêm món'}
            </button>
            <label className="btn-secondary scan-btn" style={{ cursor: 'pointer', textAlign: 'center', display: 'block', marginTop: '10px', padding: '10px', background: '#e0e0e0', borderRadius: '8px' }}>
              {isScanning ? '✨ AI Đang Phân Tích...' : '📷 Quét Ảnh bằng AI'}
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={isScanning}/>
            </label>
          </div>
        </form>
      </div>

      <div className="glass-card" style={{height: '350px', paddingBottom: '30px', marginTop: '2rem'}}>
        <h2 style={{marginBottom: '1rem'}}>Thống kê 7 ngày</h2>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorCalo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="name" stroke="var(--text-color)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-color)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', color: '#333' }}
              itemStyle={{ color: 'var(--primary-color)', fontWeight: 'bold' }}
            />
            <Area type="monotone" dataKey="calo" name="Calo" stroke="var(--primary-color)" fillOpacity={1} fill="url(#colorCalo)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card" style={{marginTop: '2rem'}}>
        <h2 style={{marginBottom: '1rem'}}>Hôm nay</h2>
        {!WEB_APP_URL ? (
           <p style={{textAlign: 'center', color: 'var(--danger-color)', fontWeight: 'bold'}}>
             Đang chờ kết nối Google Sheets...
           </p>
        ) : todayMeals.length === 0 ? (
          <p style={{textAlign: 'center', color: 'var(--text-muted)'}}>Chưa có dữ liệu bữa ăn.</p>
        ) : (
          <div className="meal-list">
            {todayMeals.map(meal => (
              <div key={meal.id} className="meal-item">
                <div className="meal-info">
                  <h4>{meal.name}</h4>
                  <p>{meal.mealType} • {new Date(meal.date).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                  <span style={{fontWeight: '600', color: 'var(--primary-color)'}}>+{meal.calories} kcal</span>
                  <button onClick={() => handleDelete(meal.id)} className="btn-danger" disabled={loading}>Xoá</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
