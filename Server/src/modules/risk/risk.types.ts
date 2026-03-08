/**
 * Risk 模块类型：与 risk_data 表查询结果一致
 */
export interface RiskCheckResult {
  risk_level: string;
  risk_category: string | null;
}
