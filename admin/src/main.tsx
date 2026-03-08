import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthProvider } from './auth';
import App from './App';
import './index.css';

const theme = {
  token: {
    colorPrimary: '#2F6BFF',
    colorBgLayout: '#F6F8FC',
    colorBgContainer: '#FFFFFF',
    colorBorder: '#E6EAF0',
    colorText: '#1F2D3D',
    colorTextSecondary: '#5F6B7A',
  },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={theme}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ConfigProvider>
  </React.StrictMode>
);
