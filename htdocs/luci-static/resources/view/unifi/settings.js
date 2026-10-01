'use strict';
'require view';
'require uci';
'require rpc';
'require unifi.model as model';

var callInterfaces = rpc.declare({ object: 'network.interface', method: 'dump', expect: { interface: [] } });

var categories = [
	{ id: 'overview', label: '概要', icon: '◫', description: '現在の設定をまとめて確認します。' },
	{ id: 'wifi', label: 'WiFi', icon: '◉', description: 'SSID、使用するネットワーク、無線の設定を確認します。' },
	{ id: 'networks', label: 'Networks', icon: '⌁', description: 'LANと仮想ネットワークの設定を確認します。' },
	{ id: 'internet', label: 'Internet', icon: '◎', description: 'WAN接続とIP設定を確認します。' },
	{ id: 'vpn', label: 'VPN', icon: '◇', description: 'ネットワークインターフェースとして設定されたVPNを確認します。' },
	{ id: 'security', label: 'Security', icon: '⬡', description: 'ファイアウォールゾーンの設定を確認します。' },
	{ id: 'routing', label: 'Routing', icon: '⇄', description: '静的ルートを確認します。' }
];

function value(input) {
	if (Array.isArray(input)) return input.length ? input.join(', ') : '—';
	return input == null || input === '' ? '—' : String(input);
}

function detail(label, input) {
	return E('div', { 'class': 'uf-setting-detail' }, [ E('span', {}, label), E('strong', {}, value(input)) ]);
}

function badge(label, good) {
	return E('span', { 'class': 'uf-setting-badge ' + (good ? 'uf-setting-badge--up' : 'uf-setting-badge--off') }, [ E('span'), label ]);
}

function settingCard(title, subtitle, status, fields) {
	return E('article', { 'class': 'uf-setting-card' }, [
		E('div', { 'class': 'uf-setting-card__top' }, [
			E('span', { 'class': 'uf-setting-card__icon', 'aria-hidden': 'true' }, '⌁'),
			E('div', { 'class': 'uf-setting-card__name' }, [ E('h3', {}, value(title)), E('small', {}, value(subtitle)) ]),
			status
		]),
		E('div', { 'class': 'uf-setting-card__details' }, fields)
	]);
}

function empty(message) {
	return E('div', { 'class': 'uf-setting-empty' }, [ E('span', {}, '○'), E('strong', {}, message) ]);
}

function protocol(input) {
	var known = { dhcp: 'DHCP', dhcpv6: 'DHCPv6', static: 'Static IP', pppoe: 'PPPoE', wireguard: 'WireGuard', none: 'Unmanaged' };
	return known[input] || value(input);
}

function isWan(section, interfaces) {
	if (/^wan\d*$/.test(section['.name'] || '')) return true;
	return interfaces.some(function(iface) {
		return iface.interface === section['.name'] && Array.isArray(iface.route) && iface.route.some(function(route) {
			return route && (route.target === '0.0.0.0' || route.target === '::') && Number(route.mask) === 0;
		});
	});
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(uci.load('network').then(function() { return true; }), false),
			L.resolveDefault(uci.load('wireless').then(function() { return true; }), false),
			L.resolveDefault(uci.load('firewall').then(function() { return true; }), false),
			L.resolveDefault(uci.load('dhcp').then(function() { return true; }), false),
			L.resolveDefault(callInterfaces(), [])
		]);
	},

	render: function(data) {
		this.loaded = { network: data[0], wireless: data[1], firewall: data[2], dhcp: data[3] };
		this.interfaces = Array.isArray(data[4]) ? data[4] : [];
		this.networks = uci.sections('network', 'interface');
		this.wifis = uci.sections('wireless', 'wifi-iface');
		this.zones = uci.sections('firewall', 'zone');
		this.routes = uci.sections('network', 'route').concat(uci.sections('network', 'route6'));
		this.dhcp = uci.sections('dhcp', 'dhcp');
		var path = L.env && L.env.dispatchpath || [];
		var initialCategory = categories.some(function(category) { return category.id === path[3]; }) ? path[3] : 'overview';
		this.category = initialCategory;
		this.refs = {};
		var categoryButtons = categories.map(function(category) {
			return E('a', { 'class': 'uf-settings-nav__item' + (category.id === initialCategory ? ' is-active' : ''), 'href': L.url('admin', 'unifi', 'settings', category.id) }, [ E('span', { 'class': 'uf-settings-nav__icon', 'aria-hidden': 'true' }, category.icon), category.label ]);
		});
		this.refs.page = E('div', { 'class': 'uf-settings-page' });
		var root = E('div', { 'class': 'uf-app uf-app--settings' }, [
			E('div', { 'class': 'uf-settings-shell' }, [
				E('aside', { 'class': 'uf-iconrail', 'aria-label': '主要メニュー' }, [
					E('span', { 'class': 'uf-iconrail__brand' }, 'U'),
					E('a', { 'href': L.url('admin/unifi/overview'), 'title': 'Overview', 'aria-label': '概要へ' }, '◫'),
					E('span', { 'class': 'uf-iconrail__active', 'title': 'Settings', 'aria-label': '設定' }, '⚙'),
					E('a', { 'href': L.url('admin/network/network'), 'title': 'LuCI', 'aria-label': 'LuCIの設定へ' }, '↗')
				]),
				E('aside', { 'class': 'uf-settings-nav', 'aria-label': '設定カテゴリ' }, [
					E('div', { 'class': 'uf-settings-nav__title' }, [ E('span', {}, 'Settings'), E('small', {}, 'OpenWrt / LuCI') ]),
					E('div', { 'class': 'uf-settings-nav__links' }, categoryButtons),
					E('div', { 'class': 'uf-settings-nav__foot' }, '設定の変更は各画面の LuCI リンクから行えます。')
				]),
				E('main', { 'class': 'uf-settings-main' }, [
					E('div', { 'class': 'uf-settings-topbar' }, [ E('span', {}, 'Network'), E('span', {}, 'UniFi for OpenWrt') ]),
					this.refs.page
				])
			])
		]);
		this.showCategory(initialCategory);
		return E('div', {}, [ E('link', { 'rel': 'stylesheet', 'href': L.resource('unifi/dashboard.css') }), root ]);
	},

	showCategory: function(id) {
		this.category = id;
		var selected = categories.find(function(category) { return category.id === id; }) || categories[0];
		var content = this.categoryContent(id);
		var nativeUrl = this.nativeUrl(id);
		var heading = [ E('div', {}, [ E('div', { 'class': 'uf-eyebrow' }, 'SETTINGS / ' + selected.label.toUpperCase()), E('h1', {}, selected.label), E('p', {}, selected.description) ]) ];
		if (nativeUrl)
			heading.push(E('a', { 'class': 'uf-settings-edit', 'href': nativeUrl }, 'LuCI で編集 ↗'));
		this.refs.page.replaceChildren(
			E('div', { 'class': 'uf-settings-heading' }, heading),
			E('div', { 'class': 'uf-settings-content' }, content)
		);
	},

	nativeUrl: function(id) {
		var paths = {
			wifi: [ 'admin', 'network', 'wireless' ],
			networks: [ 'admin', 'network', 'network' ],
			internet: [ 'admin', 'network', 'network' ],
			vpn: [ 'admin', 'network', 'network' ],
			security: [ 'admin', 'network', 'firewall' ],
			routing: [ 'admin', 'network', 'routes' ]
		};
		return paths[id] ? L.url.apply(L, paths[id]) : null;
	},

	categoryContent: function(id) {
		switch (id) {
		case 'wifi': return this.renderWifi();
		case 'networks': return this.renderNetworks();
		case 'internet': return this.renderInternet();
		case 'vpn': return this.renderVpn();
		case 'security': return this.renderSecurity();
		case 'routing': return this.renderRouting();
		default: return this.renderSettingsOverview();
		}
	},

	renderSettingsOverview: function() {
		var self = this;
		var counts = {
			wifi: this.wifis.length,
			networks: this.networks.filter(function(section) { return section['.name'] !== 'loopback' && !isWan(section, self.interfaces); }).length,
			internet: this.networks.filter(function(section) { return isWan(section, self.interfaces); }).length,
			vpn: this.networks.filter(function(section) { return /wireguard|openvpn|l2tp|pptp|ipsec/i.test(section.proto || ''); }).length,
			security: this.zones.length,
			routing: this.routes.length
		};
		return [
			E('div', { 'class': 'uf-settings-intro' }, [ E('span', { 'class': 'uf-settings-intro__icon' }, '⚙'), E('div', {}, [ E('h2', {}, 'ネットワーク設定'), E('p', {}, 'UniFiの設定構成に沿って、OpenWrtの現在値を表示します。') ]) ]),
			E('div', { 'class': 'uf-settings-tiles' }, categories.slice(1).map(function(category) {
				return E('a', { 'class': 'uf-settings-tile', 'href': L.url('admin', 'unifi', 'settings', category.id) }, [
					E('span', { 'class': 'uf-settings-tile__icon' }, category.icon),
					E('span', { 'class': 'uf-settings-tile__text' }, [ E('strong', {}, category.label), E('small', {}, category.description) ]),
					E('span', { 'class': 'uf-settings-tile__count' }, String(counts[category.id])),
					E('span', { 'class': 'uf-settings-tile__arrow' }, '›')
				]);
			}))
		];
	},

	renderInternet: function() {
		if (!this.loaded.network) return [ empty('ネットワーク設定を読み込めません') ];
		var self = this;
		var sections = this.networks.filter(function(section) { return isWan(section, self.interfaces); });
		return sections.length ? sections.map(function(section) {
			var status = self.interfaces.find(function(iface) { return iface.interface === section['.name']; });
			return settingCard(section['.name'], 'Internet Connection', badge(status && status.up ? '接続中' : '未接続', status && status.up), [
				detail('接続方式', protocol(section.proto)),
				detail('デバイス', status ? model.deviceName(status) : section.device),
				detail('IP アドレス', status ? model.firstAddress(status) : section.ipaddr),
				detail('ゲートウェイ', section.gateway),
				detail('DNS サーバー', section.dns),
				detail('MTU', section.mtu)
			]);
		}) : [ empty('WANインターフェースは見つかりません') ];
	},

	renderNetworks: function() {
		if (!this.loaded.network) return [ empty('ネットワーク設定を読み込めません') ];
		var self = this;
		var sections = this.networks.filter(function(section) { return section['.name'] !== 'loopback' && !isWan(section, self.interfaces); });
		return sections.length ? sections.map(function(section) {
			var status = self.interfaces.find(function(iface) { return iface.interface === section['.name']; });
			var dhcp = self.dhcp.find(function(item) { return item['.name'] === section['.name'] || item.interface === section['.name']; });
			return settingCard(section['.name'], 'Virtual Network', badge(status && status.up ? '稼働中' : '停止中', status && status.up), [
				detail('接続方式', protocol(section.proto)),
				detail('デバイス', section.device),
				detail('IP アドレス', status ? model.firstAddress(status) : section.ipaddr),
				detail('サブネットマスク', section.netmask),
				detail('DHCP サーバー', dhcp ? (dhcp.ignore === '1' ? '無効' : '有効') : '—'),
				detail('VLAN ID', section.device && /\.(\d+)$/.exec(section.device) ? /\.(\d+)$/.exec(section.device)[1] : '—')
			]);
		}) : [ empty('ネットワークがありません') ];
	},

	renderWifi: function() {
		if (!this.loaded.wireless) return [ empty('WiFi設定を読み込めません') ];
		return this.wifis.length ? this.wifis.map(function(section) {
			var enabled = section.disabled !== '1';
			return settingCard(section.ssid || section['.name'], 'Wireless Network', badge(enabled ? '有効' : '無効', enabled), [
				detail('SSID', section.ssid),
				detail('ネットワーク', section.network),
				detail('無線デバイス', section.device),
				detail('モード', section.mode === 'ap' ? 'Access Point' : section.mode),
				detail('セキュリティ', section.encryption),
				detail('SSID非表示', section.hidden === '1' ? '有効' : '無効')
			]);
		}) : [ empty('WiFiインターフェースがありません') ];
	},

	renderVpn: function() {
		if (!this.loaded.network) return [ empty('ネットワーク設定を読み込めません') ];
		var sections = this.networks.filter(function(section) { return /wireguard|openvpn|l2tp|pptp|ipsec/i.test(section.proto || ''); });
		return sections.length ? sections.map(function(section) {
			return settingCard(section['.name'], 'VPN Interface', badge(section.disabled === '1' ? '無効' : '設定済み', section.disabled !== '1'), [
				detail('方式', protocol(section.proto)),
				detail('IP アドレス', section.addresses || section.ipaddr),
				detail('MTU', section.mtu)
			]);
		}) : [ empty('UCIネットワーク内にVPNインターフェースはありません') ];
	},

	renderSecurity: function() {
		if (!this.loaded.firewall) return [ empty('ファイアウォール設定を読み込めません') ];
		return this.zones.length ? this.zones.map(function(section) {
			var enabled = section.enabled !== '0';
			return settingCard(section.name || section['.name'], 'Firewall Zone', badge(enabled ? '有効' : '無効', enabled), [
				detail('対象ネットワーク', section.network),
				detail('Input', section.input),
				detail('Output', section.output),
				detail('Forward', section.forward),
				detail('Masquerading', section.masq === '1' ? '有効' : '無効')
			]);
		}) : [ empty('ファイアウォールゾーンがありません') ];
	},

	renderRouting: function() {
		if (!this.loaded.network) return [ empty('ルート設定を読み込めません') ];
		return this.routes.length ? this.routes.map(function(section) {
			var enabled = section.disabled !== '1';
			return settingCard(section['.name'], section['.type'] === 'route6' ? 'IPv6 Static Route' : 'IPv4 Static Route', badge(enabled ? '設定済み' : '無効', enabled), [
				detail('宛先', section.target),
				detail('マスク', section.netmask),
				detail('ゲートウェイ', section.gateway),
				detail('インターフェース', section.interface),
				detail('メトリック', section.metric)
			]);
		}) : [ empty('静的ルートがありません') ];
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
