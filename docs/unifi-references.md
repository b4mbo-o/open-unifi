# UniFi Network 画面調査

2026年10月時点で公開されているUbiquiti公式の画像とヘルプを参照。画像はリンクのみ記載し、このリポジトリには複製していません。各バージョンでUIは変化するため、このアプリでは共通する構造と設定分類を採用しています。

## 実画面の参照

| 画面 | 参照画像 | 確認した点 |
| --- | --- | --- |
| Network 9.1 ダッシュボード | [画像](https://cdn.blog.svc.ui.com/large_Network_9_1_Blog_02_bb743da873.png) | 左の細いアイコン列、ゲートウェイ情報、トラフィックグラフ、ISP状態 |
| Network 9.1 サイドバー | [画像](https://cdn.blog.svc.ui.com/large_Network_9_1_Blog_04_2a0053c53b.png) | アプリ上部のサイト選択とゲートウェイ情報の配置 |
| Network 9.1 WiFi設定 | [画像](https://cdn.blog.svc.ui.com/large_Network_9_1_Blog_05_74fed1b311.png) | WiFi、Networks、Internet、VPN、Security、Routing の設定カテゴリ |
| Network 9.1 トラフィック | [画像](https://cdn.blog.svc.ui.com/large_Network_9_1_Blog_01_2860deda4d.png) | Insights のタブ構成、Top Destinations と Top Clients |
| Network 9.3 DHCP管理 | [公式記事](https://blog.ui.com/article/introducing-network-9-3) | DHCPリースを独立した一覧で扱う構成 |
| Network 9.4 ポリシー | [画像](https://cdn.blog.svc.ui.com/large_Network_9_4_04_dea32cec88.jpg) | ポリシーの表と列構成 |
| Network 9.5 無線状態 | [画像](https://cdn.blog.svc.ui.com/large_Network_95_01_884c16ea38.jpg) | ラジオ分析の左フィルターと右側の密なデータ表 |
| Network 10.5 セキュリティ | [画像](https://cdn.blog.svc.ui.com/large_Network_10_5_03_9d8befde56.jpg) | Firewallのマトリクスとルール表 |
| Network 10.6 トポロジー | [画像](https://cdn.blog.svc.ui.com/large_Network_10_6_01_7d66492dc5.jpg) | 現行のアイコン列、フィルター領域、広い作業領域 |
| Network 10.6 無線画面 | [画像](https://cdn.blog.svc.ui.com/large_Network_10_6_02_37a6ca641e.jpg) | アイコン列と二段目の操作領域が継続していること |

## 設定項目の対応

| UniFi Network | 公式説明 | このアプリで現在表示するOpenWrtの情報 |
| --- | --- | --- |
| Settings > Internet | [WANとフェイルオーバー](https://help.ui.com/hc/en-us/articles/360052548713-WAN-Failover-Load-Balancing-and-Port-Remapping-on-UniFi-Gateways) | WANのUCIインターフェース、方式、IP、DNS、MTU |
| Settings > Networks | [VLANの作成](https://help.ui.com/hc/en-us/articles/9761080275607-Creating-Virtual-Networks-VLANs) | LANインターフェース、IP、DHCP、デバイス名から分かるVLAN ID |
| Settings > WiFi | [SSIDとAP設定](https://help.ui.com/hc/en-us/articles/32065480092951-UniFi-WiFi-SSID-and-AP-Settings-Overview) | SSID、ネットワーク、無線デバイス、暗号化方式 |
| Settings > Security | [UniFiのトラフィック識別](https://help.ui.com/hc/en-us/articles/12570783535383-UniFi-Gateway-Traffic-and-Device-Identification) | OpenWrtのファイアウォールゾーン。UniFiのDPIやポリシーとは別機能 |
| Insights > Flows | [フローとログ](https://help.ui.com/hc/en-us/articles/32201256219799-Traffic-Flows-and-Traffic-Logging-in-UniFi-Network) | 未実装。現状のグラフはWANデバイスの総通信量のみ |

設定の編集、端末別通信量、DPI、トポロジー、ポートマップは今後の実装対象です。OpenWrtのパッケージや機種によって取得できる情報が異なるため、実機のデータに合わせて追加します。
