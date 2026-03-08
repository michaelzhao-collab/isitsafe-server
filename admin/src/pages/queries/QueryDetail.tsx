import { useEffect, useState } from 'react';
import { Card, Descriptions, Button, Spin, message, Tag } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { getQueryDetail, type QueryItem } from '../../api/queries';

const riskColor: Record<string, string> = {
  high: '#FF4D4F',
  medium: '#F5A623',
  low: '#2ECC71',
  unknown: '#8A94A6',
};

export default function QueryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryItem | null>(null);

  useEffect(() => {
    if (!id) return;
    getQueryDetail(id)
      .then(setQuery)
      .catch((e) => message.error(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!query) {
    return (
      <Card>
        <p>未找到该记录</p>
        <Button type="primary" onClick={() => navigate('/queries')}>
          返回列表
        </Button>
      </Card>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#1F2D3D' }}>查询详情</h2>
      <Card>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="query_id">{query.id}</Descriptions.Item>
          <Descriptions.Item label="user_id">{query.userId ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="input_type">{query.inputType}</Descriptions.Item>
          {query.imageUrl && (
            <Descriptions.Item label="用户上传图片">
              <a href={query.imageUrl} target="_blank" rel="noopener noreferrer">
                查看原图
              </a>
              <div style={{ marginTop: 8 }}>
                <img
                  src={query.imageUrl}
                  alt="用户上传"
                  style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 8, border: '1px solid #eee' }}
                />
              </div>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="content">
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>{query.content}</pre>
          </Descriptions.Item>
          <Descriptions.Item label="risk_level">
            <Tag color={riskColor[query.riskLevel?.toLowerCase()] ?? '#8A94A6'}>{query.riskLevel}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="confidence">{query.confidence ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="ai_provider">{query.aiProvider ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="created_at">{query.createdAt?.slice(0, 19)}</Descriptions.Item>
          {query.user && (
            <Descriptions.Item label="用户">
              {[query.user.phone, query.user.email].filter(Boolean).join(' / ') || '-'}
            </Descriptions.Item>
          )}
        </Descriptions>
        <div style={{ marginTop: 16 }}>
          <Button onClick={() => navigate('/queries')}>返回列表</Button>
        </div>
      </Card>
    </div>
  );
}
