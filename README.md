# OpenUniFi for OpenWrt

OpenWrt 25.12 の LuCI に追加する、UniFi Network を参考にした非公式のテーマと管理画面です。現段階の独自ページは**読み取り専用**です。調査した実画面と設定項目は [docs/unifi-references.md](docs/unifi-references.md) にまとめています。

リポジトリ直下は `luci-app-unifi-dashboard`、`theme/` は `luci-theme-open-unifi` のパッケージです。テーマを選ぶと、独自ページに加えて通常の LuCI ページにも配色・ナビゲーションが適用されます。

## できること

- WAN の接続状態、IP アドレス、インターフェースを表示
- WAN デバイスの受信・送信バイト数から通信速度を2秒ごとに算出し、直近約1分をグラフ化
- 起動後のWAN転送量、稼働時間、メモリ使用率、1分負荷を表示
- 「Overview」「Traffic」「Clients」と、概要・WiFi・Networks・Internet・VPN・Security・Routing のURLを持つ「Settings」ページ
- インターフェース一覧と DHCP リース一覧を表示し、端末名・IP・MAC で検索
- ネットワーク、Wi-Fi、ファイアウォールの標準 LuCI 設定画面へ移動
- UniFi風の「Settings」で Internet、Networks、WiFi、VPN、Security、Routing を表示
- OpenWrt の UCI 設定から、WAN方式・DNS・MTU、LAN・DHCP、SSID・暗号化方式、ファイアウォールゾーン、静的ルートを表示

「端末」は DHCP リースの一覧です。接続中の端末数や端末別の通信量は表していません。グラフはブラウザを開いている間だけ保持し、永続化しません。WANの受信・送信量は選択したデバイスの起動後カウンターです。Settings は UCI の値を表示し、WiFiパスワードなどの機密項目は画面に出しません。設定の変更は各カテゴリの「LuCI で編集」から行います。

## 前提

- LuCI、`rpcd-mod-luci`、`luci-theme-openwrt-2020` が使える OpenWrt 25.12
- WAN が `wan` またはデフォルトルートを持つ論理インターフェースとして認識されること

## 導入

OpenWrt のビルド環境では、リポジトリ直下を LuCI feed の `applications/luci-app-unifi-dashboard` に、`theme/` を `themes/luci-theme-open-unifi` に配置してビルドします。アプリのパッケージはテーマに依存します。

開発用に既存のルーターへ直接配置する場合、アプリの `htdocs/` を `/www/`、`root/` を `/` にコピーします。テーマの `theme/htdocs/` を `/www/`、`theme/ucode/` を `/usr/share/ucode/luci/`、`theme/root/` を `/` にコピーします。`luci-theme-openwrt-2020` は事前に導入してください。

配置後、ルーター上でテーマを登録・選択します。

```sh
sh /etc/uci-defaults/30_luci-theme-open-unifi
uci set luci.main.mediaurlbase='/luci-static/open-unifi'
uci commit luci
```

LuCI に再ログインすると適用されます。直接配置したアプリのメニューや ACL が出ない場合は `rpcd` を再起動してください。元のテーマに戻す場合は `luci.main.mediaurlbase` を以前の値に戻してください。標準の OpenWrt 2020 テーマなら `/luci-static/openwrt2020` です。

## 開発時の確認

```sh
node --test test/dashboard.test.js
node --check htdocs/luci-static/resources/view/unifi/overview.js
node --check htdocs/luci-static/resources/view/unifi/settings.js
python3 -m json.tool root/usr/share/rpcd/acl.d/luci-app-unifi-dashboard.json >/dev/null
python3 -m json.tool root/usr/share/luci/menu.d/luci-app-unifi-dashboard.json >/dev/null
```

テーマのテンプレートは LuCI の OpenWrt 2020 テーマを基にしており、Apache-2.0 ライセンスです。実機でのテーマ切り替えと標準 LuCI 全ページの表示確認はまだ行っていません。
