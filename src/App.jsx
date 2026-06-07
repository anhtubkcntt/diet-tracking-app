import { useState, useEffect } from 'react';

// TODO: Thay bằng Web App URL do user cung cấp
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzlYwq4lKUJz4f6B5GYAsfM-JB2X2izkGsVjEvgO6QhIDPM3bAQ_cqyYtRVb8NW_3jnVg/exec';

function App() {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(false);
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

  const totalCalories = meals.reduce((sum, meal) => sum + Number(meal.calories || 0), 0);
  const progressPercent = Math.min((totalCalories / goal) * 100, 100);

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
          
          <button type="submit" className="btn" style={{width: '100%'}} disabled={loading || !WEB_APP_URL}>
            {loading ? 'Đang lưu...' : '+ Thêm món'}
          </button>
        </form>
      </div>

      <div className="glass-card">
        <h2 style={{marginBottom: '1rem'}}>Hôm nay</h2>
        {!WEB_APP_URL ? (
           <p style={{textAlign: 'center', color: 'var(--danger-color)', fontWeight: 'bold'}}>
             Đang chờ kết nối Google Sheets...
           </p>
        ) : meals.length === 0 ? (
          <p style={{textAlign: 'center', color: 'var(--text-muted)'}}>Chưa có dữ liệu bữa ăn.</p>
        ) : (
          <div className="meal-list">
            {meals.map(meal => (
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
