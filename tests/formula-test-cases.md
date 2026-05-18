# Savant AI Formula Engine v1 测试集

本测试集用于验证中文办公语义到 Excel 公式生成的稳定性，重点覆盖常见条件计数、条件求和、条件平均、条件判断和重复检测场景。

> 注意：本测试文档仅用于人工验证，不包含自动化测试代码。

## 1. COUNTIF / 条件计数

| 编号 | 用户输入 | 预期意图 | 预期涉及列 | 预期公式类型 | 测试状态 |
|---|---|---|---|---|---|
| 1 | 统计 Region 列中为“上海”的记录数量 | 条件计数 | Region | COUNTIF | 通过|
| 2 | 计算 Status 是“已完成”的任务个数 | 条件计数 | Status | COUNTIF | 未通过 |
| 3 | 统计 Category 为“办公耗材”的条目数 | 条件计数 | Category | COUNTIF | 通过 |
| 4 | 统计 Owner 是“张伟”的项目数量 | 条件计数 | Owner | COUNTIF | 未通过 |
| 5 | 统计 Sales 大于 10000 的订单数量 | 条件计数 | Sales | COUNTIF | 通过 |
| 6 | 统计 Product 等于“笔记本”的记录数 | 条件计数 | Product | COUNTIF | 通过 |
| 7 | 统计 Cost 小于 500 的费用项数量 | 条件计数 | Cost | COUNTIF | 通过 |
| 8 | 统计 Region 不是“北京”的销售记录数 | 条件计数 | Region | COUNTIF | 通过 |
| 9 | 统计 Status 为“审核中”的合同数 | 条件计数 | Status | COUNTIF | 通过 |
| 10 | 统计 Category 包含“软件”的条目个数 | 条件计数 | Category | COUNTIF | 通过 |

## 2. SUMIF / 条件求和

| 编号 | 用户输入 | 预期意图 | 预期涉及列 | 预期公式类型 | 测试状态 |
|---|---|---|---|---|---|
| 1 | 求 Region 为“广州”的 Sales 总和 | 条件求和 | Region, Sales | SUMIF | 通过 |
| 2 | 计算 Status 为“已支付”订单的 Cost 合计 | 条件求和 | Status, Cost | SUMIF | 通过 |
| 3 | 求 Category 为“广告费用”的 Cost 总额 | 条件求和 | Category, Cost | SUMIF | 通过 |
| 4 | 统计 Owner 是“李娜”负责项目的 Sales 合计 | 条件求和 | Owner, Sales | SUMIF | 未通过 |
| 5 | 求 Product 为“显示器”的 Sales 总和 | 条件求和 | Product, Sales | SUMIF | 通过 |
| 6 | 计算 Region 为“深圳”且 Sales 大于 0 的销售额 | 条件求和 | Region, Sales | SUMIF | 通过 |
| 7 | 求 Status 为“待结算”的 Cost 合计 | 条件求和 | Status, Cost | SUMIF | 通过 |
| 8 | 统计 Category 为“差旅报销”的 Cost 总额 | 条件求和 | Category, Cost | SUMIF | 通过 |
| 9 | 求 Owner 是“王强”的 Sales 合计 | 条件求和 | Owner, Sales | SUMIF | 未通过 |
| 10 | 计算 Status 为“已完成”且 Region 为“上海”的 Sales 总和 | 条件求和 | Status, Region, Sales | SUMIF | 通过 |

## 3. AVERAGEIF / 条件平均值

| 编号 | 用户输入 | 预期意图 | 预期涉及列 | 预期公式类型 | 测试状态 |
|---|---|---|---|---|---|
| 1 | 计算 Status 为“已完成”项目的 Cost 平均值 | 条件平均 | Status, Cost | AVERAGEIF | 通过 |
| 2 | 求 Category 为“营销活动”的 Sales 平均值 | 条件平均 | Category, Sales | AVERAGEIF | 未通过 |
| 3 | 计算 Region 为“深圳”的 Cost 平均数 | 条件平均 | Region, Cost | AVERAGEIF | 未通过 |
| 4 | 统计 Owner 为“赵敏”负责任务的 Sales 平均值 | 条件平均 | Owner, Sales | AVERAGEIF | 未通过 |
| 5 | 计算 Product 为“打印机”的 Cost 平均值 | 条件平均 | Product, Cost | AVERAGEIF | 通过 |
| 6 | 求 Status 为“待审核”的 Cost 平均数 | 条件平均 | Status, Cost | AVERAGEIF | 通过 |
| 7 | 计算 Category 为“差旅费”的 Sales 平均值 | 条件平均 | Category, Sales | AVERAGEIF | 未通过 |
| 8 | 统计 Region 为“北京”的 Cost 平均值 | 条件平均 | Region, Cost | AVERAGEIF | 通过 |
| 9 | 计算 Status 为“已付款”且 Category 为“办公用品”的 Cost 平均值 | 条件平均 | Status, Category, Cost | AVERAGEIF | 通过 |
| 10 | 求 Owner 是“陈涛”的 Sales 平均数 | 条件平均 | Owner, Sales | AVERAGEIF | 未通过 |

## 4. IF / 条件判断

| 编号 | 用户输入 | 预期意图 | 预期涉及列 | 预期公式类型 | 测试状态 |
|---|---|---|---|---|---|
| 1 | 如果 Status 是“已完成”，显示“完成”，否则显示“进行中” | 条件判断 | Status | IF | 通过 |
| 2 | 如果 Sales 大于 10000，则返回“优”，否则返回“待提升” | 条件判断 | Sales | IF | 通过 |
| 3 | 如果 Cost 超过 5000，则标记为“高成本”，否则为“正常” | 条件判断 | Cost | IF | 通过 |
| 4 | 如果 Region 为“上海”，则返回“华东区”，否则“其他地区” | 条件判断 | Region | IF | 通过 |
| 5 | 如果 Category 是“差旅费”，则显示“报销”，否则显示“不报销” | 条件判断 | Category | IF | 未通过 |
| 6 | 如果 Owner 等于“刘洋”，则显示“刘洋负责”，否则显示“其他负责人” | 条件判断 | Owner | IF | 通过 |
| 7 | 如果 Product 为“服务费”，则返回“服务”，否则返回“商品” | 条件判断 | Product | IF | 通过 |
| 8 | 如果 Date 早于 2025-01-01，则返回“旧数据”，否则返回“新数据” | 条件判断 | Date | IF | 未通过 |
| 9 | 如果 Status 是“已取消”，则返回“取消”，否则返回“有效” | 条件判断 | Status | IF | 通过 |
| 10 | 如果 Sales 小于 0，则返回“异常”，否则返回“正常” | 条件判断 | Sales | IF | 通过 |

## 5. Duplicate Check / 重复检测

| 编号 | 用户输入 | 预期意图 | 预期涉及列 | 预期公式类型 | 测试状态 |
|---|---|---|---|---|---|
| 1 | 检查 Product 列是否有重复项 | 重复检测 | Product | COUNTIF / 重复检查 | 通过 |
| 2 | 查找 Category 和 Region 组合是否重复 | 重复检测 | Category, Region | COUNTIFS / 重复检查 | 通过 |
| 3 | 判断 Status 和 Owner 是否存在重复组合 | 重复检测 | Status, Owner | COUNTIFS / 重复检查 | 通过 |
| 4 | 检查相同 Date 是否出现多次 | 重复检测 | Date | COUNTIF / 重复检查 | 未通过 |
| 5 | 判断 Cost 和 Sales 同时重复的记录 | 重复检测 | Cost, Sales | COUNTIFS / 重复检查 | 通过 |
| 6 | 检查 Region 为“上海”的 Product 是否重复 | 重复检测 | Region, Product | COUNTIFS / 重复检查 | 未通过 |
| 7 | 查找 Owner 为“张伟”且 Status 相同的重复记录 | 重复检测 | Owner, Status | COUNTIFS / 重复检查 | 通过 |
| 8 | 判断 Category 为“办公用品”时是否有重复 Product | 重复检测 | Category, Product | COUNTIFS / 重复检查 | 通过 |
| 9 | 检查 Sales 等于 0 的记录是否重复 | 重复检测 | Sales | COUNTIF / 重复检查 | 通过 |
| 10 | 检查 Sales 等于 0 的记录是否重复 | 重复检测 | Owner, Date | COUNTIFS / 重复检查 | 通过 |
