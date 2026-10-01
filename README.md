# UniFi Dashboard for OpenWrt

OpenWrt 25.12 の LuCI に追加する、UniFi Network を参考にした非公式の管理画面です。現段階は**読み取り専用の初期版**です。調査した実画面と設定項目は [docs/unifi-references.md](docs/unifi-references.md) にまとめています。

## できること

- WAN の接続状態、IP アドレス、インターフェースを表示
- WAN デバイスの受信・送信バイト数から通信速度を2秒ごとに算出し、直近約1分をグラフ化
- 起動後のWAN転送量、稼働時間、メモリ使用率、1分負荷を表示
- インターフェース一覧と DHCP リース一覧を表示し、端末名・IP・MAC で検索
- ネットワーク、Wi-Fi、ファイアウォールの標準 LuCI 設定画面へ移動
- UniFi風の「Settings」で Internet、Networks、WiFi、VPN、Security、Routing を表示
- OpenWrt の UCI 設定から、WAN方式・DNS・MTU、LAN・DHCP、SSID・暗号化方式、ファイアウォールゾーン、静的ルートを表示

「端末」は DHCP リースの一覧です。接続中の端末数や端末別の通信量は表していません。グラフはブラウザを開いている間だけ保持し、永続化しません。WANの受信・送信量は選択したデバイスの起動後カウンターです。Settings は UCI の値を表示し、WiFiパスワードなどの機密項目は画面に出しません。設定の変更は各カテゴリの「LuCI で編集」から行います。

## 前提

- LuCI と `rpcd-mod-luci` が使える OpenWrt 25.12
- WAN が `wan` またはデフォルトルートを持つ論理インターフェースとして認識されること

## 導入

OpenWrt のビルド環境では、このディレクトリを LuCI feed の `applications/luci-app-unifi-dashboard` に配置して `luci-app-unifi-dashboard` をビルドします。`Makefile` は LuCI feed の標準形式です。

開発用に既存のルーターへ直接配置する場合、`htdocs/` の中身を `/www/`、`root/` の中身を `/` にコピーします。ACL を読み込むために `rpcd` を再起動し、LuCI に再ログインすると「UniFi Dashboard」が表示されます。直接配置時は LuCI と `rpcd-mod-luci` を事前に導入してください。

## 開発時の確認

```sh
node --test test/dashboard.test.js
node --check htdocs/luci-static/resources/view/unifi/overview.js
node --check htdocs/luci-static/resources/view/unifi/settings.js
python3 -m json.tool root/usr/share/rpcd/acl.d/luci-app-unifi-dashboard.json >/dev/null
```

実機への配置と表示確認はまだ行っていません。OpenWrt 25.12 の実機で、WAN名・WiFi構成・ACLの動作確認が必要です。
