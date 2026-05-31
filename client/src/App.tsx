import { Routes, Route } from 'react-router-dom';
import TopPage from './pages/TopPage';
import QuizmasterPage from './pages/QuizmasterPage';
import PlayerPage from './pages/PlayerPage';
import ResultPage from './pages/ResultPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TopPage />} />
      <Route path="/quizmaster/:roomId" element={<QuizmasterPage />} />
      <Route path="/player/:roomId" element={<PlayerPage />} />
      <Route path="/result" element={<ResultPage />} />
    </Routes>
  );
}
