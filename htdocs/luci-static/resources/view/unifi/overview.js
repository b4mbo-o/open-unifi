'use strict';
'require view';
'require rpc';
'require poll';
'require unifi.model as model';

var callInterfaces = rpc.declare({ object: 'network.interface', method: 'dump', expect: { interface: [] } });
var callDevice = rpc.declare({ object: 'network.device', method: 'status', params: [ 'name' ] });
var callBoard = rpc.declare({ object: 'system', method: 'board' });
var callInfo = rpc.declare({ object: 'system', method: 'info' });
var callLeases = rpc.declare({ object: 'luci-rpc', method: 'getDHCPLeases' });

function text(node, value) {
	node.textContent = value == null ? '—' : String(value);
}

function element(tag, className, children) {
	return E(tag, { 'class': className }, children);
}

function dot(label, active) {
	return E('span', { 'class': 'uf-pill ' + (active ? 'uf-pill--up' : 'uf-pill--down') }, [
		E('span', { 'class': 'uf-pill__dot' }), label
	]);
}

function icon(name) {
	var glyphs = { overview: '◫', clients: '▤', network: '⌁', wifi: '◉', firewall: '◇' };
	return E('span', { 'class': 'uf-nav__icon', 'aria-hidden': 'true' }, glyphs[name] || '•');
}

function link(url, glyph, label) {
	return E('a', { 'class': 'uf-nav__item uf-nav__link', 'href': url }, [ icon(glyph), E('span', {}, label), E('span', { 'class': 'uf-nav__arrow' }, '↗') ]);
}

function infoRow(label, value) {
	return E('div', { 'class': 'uf-detail-row' }, [
		E('span', {}, label), E('strong', {}, value == null ? '—' : String(value))
	]);
}

function chartPath(values, key, maximum, close) {
	if (!values.length) return '';
	var startX = (30 - values.length) * 760 / 29;
	var points = values.map(function(point, index) {
		var x = startX + index * 760 / 29;
		var y = 178 - Math.min(point[key] / maximum, 1) * 160;
		return x.toFixed(1) + ',' + y.toFixed(1);
	});
	var path = 'M' + points.join(' L');
	return close ? path + ' L760,178 L' + startX.toFixed(1) + ',178 Z' : path;
}

function svgPath(d, stroke, fill, width) {
	var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	path.setAttribute('d', d);
	path.setAttribute('stroke', stroke);
	path.setAttribute('fill', fill);
	path.setAttribute('stroke-width', width || '2.5');
	path.setAttribute('stroke-linejoin', 'round');
	path.setAttribute('stroke-linecap', 'round');
	return path;
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callInterfaces(), null),
			L.resolveDefault(callBoard(), {}),
			L.resolveDefault(callInfo(), {}),
			L.resolveDefault(callLeases(), {})
		]);
	},

	render: function(data) {
		this.interfacesLoaded = Array.isArray(data[0]);
		this.interfaces = this.interfacesLoaded ? data[0] : [];
		this.board = data[1] || {};
		this.info = data[2] || {};
		this.leases = model.leases(data[3]);
		this.wan = model.selectWan(this.interfaces);
		this.currentDevice = null;
		this.previous = null;
		this.history = [];
		this.rxRate = 0;
		this.txRate = 0;
		this.totalRx = null;
		this.totalTx = null;
		this.search = '';
		this.refs = {};

		var self = this;
		var refs = this.refs;
		var navOverview = E('button', { 'class': 'uf-nav__item is-active', 'type': 'button', 'onclick': function() { self.showTab('overview'); } }, [ icon('overview'), E('span', {}, '概要') ]);
		var navClients = E('button', { 'class': 'uf-nav__item', 'type': 'button', 'onclick': function() { self.showTab('clients'); } }, [ icon('clients'), E('span', {}, '端末') ]);
		refs.navOverview = navOverview;
		refs.navClients = navClients;

		var root = E('div', { 'class': 'uf-app' }, [
			E('div', { 'class': 'uf-shell' }, [
				E('aside', { 'class': 'uf-iconrail', 'aria-label': '主要メニュー' }, [
					E('span', { 'class': 'uf-iconrail__brand' }, 'U'),
					E('span', { 'class': 'uf-iconrail__active', 'title': 'Overview', 'aria-label': '概要' }, '◫'),
					E('a', { 'href': L.url('admin/unifi/settings'), 'title': 'Settings', 'aria-label': '設定へ' }, '⚙'),
					E('a', { 'href': L.url('admin/network/network'), 'title': 'LuCI', 'aria-label': 'LuCIへ' }, '↗')
				]),
				E('aside', { 'class': 'uf-sidebar' }, [
					E('div', { 'class': 'uf-brand' }, E('span', { 'class': 'uf-brand__name' }, [ 'Network', E('small', {}, this.board.hostname || 'OpenWrt') ])),
					E('div', { 'class': 'uf-nav__label' }, 'WORKSPACE'),
					E('nav', { 'class': 'uf-nav', 'aria-label': 'ダッシュボード' }, [ navOverview, navClients ]),
					E('div', { 'class': 'uf-nav__label uf-nav__label--second' }, 'OPENWRT SETTINGS'),
					E('nav', { 'class': 'uf-nav', 'aria-label': 'OpenWrt設定' }, [
						link(L.url('admin/unifi/settings'), 'network', 'UniFi風の設定'),
						link(L.url('admin/network/network'), 'network', 'ネットワーク'),
						link(L.url('admin/network/wireless'), 'wifi', 'Wi-Fi'),
						link(L.url('admin/network/firewall'), 'firewall', 'ファイアウォール')
					]),
					E('div', { 'class': 'uf-sidebar__foot' }, [ E('span', { 'class': 'uf-sidebar__foot-dot' }), 'OpenWrt 管理画面' ])
				]),
				E('main', { 'class': 'uf-main' }, [
					E('header', { 'class': 'uf-topbar' }, [
						E('div', { 'class': 'uf-breadcrumb' }, [ 'Network', E('span', {}, '/'), 'Dashboard' ]),
						E('div', { 'class': 'uf-topbar__right' }, [ E('span', { 'class': 'uf-live-dot' }), 'LIVE', E('span', { 'class': 'uf-topbar__divider' }), E('span', {}, this.board.hostname || 'OpenWrt') ])
					]),
					(refs.overview = E('section', { 'class': 'uf-page' }, this.renderOverview())),
					(refs.clientsPage = E('section', { 'class': 'uf-page', 'style': 'display:none' }, this.renderClientsPage()))
				])
			])
		]);
		this.refreshDisplay();
		this.renderRecentClients();
		this.renderClientRows();
		poll.add(this.refreshTraffic.bind(this), 2);
		poll.add(this.refreshLeases.bind(this), 15);
		this.refreshTraffic();
		return E('div', {}, [ E('link', { 'rel': 'stylesheet', 'href': L.resource('unifi/dashboard.css') }), root ]);
	},

	renderOverview: function() {
		var refs = this.refs;
		refs.heroStatus = E('div', { 'class': 'uf-hero__status' });
		refs.wanName = E('strong', { 'class': 'uf-hero__value' });
		refs.wanIp = E('strong', { 'class': 'uf-hero__value' });
		refs.download = E('strong', { 'class': 'uf-stat__value' });
		refs.upload = E('strong', { 'class': 'uf-stat__value' });
		refs.deviceCount = E('strong', { 'class': 'uf-stat__value' });
		refs.uptime = E('strong', { 'class': 'uf-stat__value' });
		refs.totalDownload = E('strong');
		refs.totalUpload = E('strong');
		refs.chartDownload = E('strong', { 'class': 'uf-chart__rate' });
		refs.chartUpload = E('strong', { 'class': 'uf-chart__rate' });
		refs.chart = E('div', { 'class': 'uf-chart__canvas' });
		refs.interfaces = E('div', { 'class': 'uf-list' });
		refs.memoryValue = E('strong');
		refs.memoryBar = E('span', { 'class': 'uf-progress__fill' });
		refs.load = E('strong');
		refs.model = E('strong');
		refs.recentClients = E('div', { 'class': 'uf-list' });
		refs.updated = E('span');

		return [
			E('div', { 'class': 'uf-heading' }, [ E('div', {}, [ E('div', { 'class': 'uf-eyebrow' }, 'OVERVIEW'), E('h1', {}, 'ネットワークの概要'), E('p', {}, 'ゲートウェイと接続状況をひと目で確認できます。') ]), E('div', { 'class': 'uf-updated' }, [ '最終更新 ', refs.updated ]) ]),
			E('div', { 'class': 'uf-hero' }, [
				E('div', { 'class': 'uf-hero__identity' }, [ E('div', { 'class': 'uf-device-icon', 'aria-hidden': 'true' }, [ E('span'), E('span'), E('span') ]), E('div', {}, [ E('div', { 'class': 'uf-hero__label' }, 'INTERNET GATEWAY'), E('h2', {}, this.board.hostname || 'OpenWrt Gateway'), refs.heroStatus ]) ]),
				E('div', { 'class': 'uf-hero__details' }, [ E('div', {}, [ E('span', {}, 'WAN インターフェース'), refs.wanName ]), E('div', {}, [ E('span', {}, 'IP アドレス'), refs.wanIp ]) ])
			]),
			E('div', { 'class': 'uf-stats' }, [
				this.statCard('↓', 'ダウンロード', refs.download, 'WAN受信速度', 'uf-stat--blue'),
				this.statCard('↑', 'アップロード', refs.upload, 'WAN送信速度', 'uf-stat--violet'),
				this.statCard('▣', 'DHCPリース', refs.deviceCount, '現在の割り当て数', 'uf-stat--mint'),
				this.statCard('◷', '稼働時間', refs.uptime, '最後の再起動から', 'uf-stat--amber')
			]),
			E('div', { 'class': 'uf-card uf-chart' }, [
				E('div', { 'class': 'uf-card__head' }, [ E('div', {}, [ E('div', { 'class': 'uf-card__eyebrow' }, 'TRAFFIC'), E('h2', {}, 'ネットワークトラフィック') ]), E('span', { 'class': 'uf-live-badge' }, [ E('span'), ' リアルタイム' ]) ]),
				E('div', { 'class': 'uf-chart__rates' }, [ E('div', {}, [ E('span', { 'class': 'uf-legend-dot uf-legend-dot--blue' }), 'ダウンロード', refs.chartDownload ]), E('div', {}, [ E('span', { 'class': 'uf-legend-dot uf-legend-dot--violet' }), 'アップロード', refs.chartUpload ]) ]),
				refs.chart,
				E('div', { 'class': 'uf-chart__foot' }, [ E('span', {}, '直近約1分 · 2秒間隔'), E('span', {}, 'WANデバイスのカウンターから算出') ])
			]),
			E('div', { 'class': 'uf-grid' }, [
				E('div', { 'class': 'uf-card' }, [ E('div', { 'class': 'uf-card__head' }, [ E('div', {}, [ E('div', { 'class': 'uf-card__eyebrow' }, 'INTERFACES'), E('h2', {}, 'ネットワーク') ]) ]), refs.interfaces ]),
				E('div', { 'class': 'uf-card' }, [ E('div', { 'class': 'uf-card__head' }, [ E('div', {}, [ E('div', { 'class': 'uf-card__eyebrow' }, 'SYSTEM'), E('h2', {}, 'ゲートウェイの状態') ]) ]), E('div', { 'class': 'uf-system' }, [ E('div', { 'class': 'uf-system__memory' }, [ E('div', {}, [ E('span', {}, 'メモリ使用率'), refs.memoryValue ]), E('div', { 'class': 'uf-progress' }, refs.memoryBar) ]), infoRow('モデル', this.board.model || '—'), E('div', { 'class': 'uf-detail-row' }, [ E('span', {}, '1分負荷'), refs.load ]), E('div', { 'class': 'uf-detail-row' }, [ E('span', {}, '起動後の受信量'), refs.totalDownload ]), E('div', { 'class': 'uf-detail-row' }, [ E('span', {}, '起動後の送信量'), refs.totalUpload ]) ]) ])
			]),
			E('div', { 'class': 'uf-card uf-recent' }, [ E('div', { 'class': 'uf-card__head' }, [ E('div', {}, [ E('div', { 'class': 'uf-card__eyebrow' }, 'DEVICES'), E('h2', {}, '最近のDHCPリース') ]), E('button', { 'class': 'uf-text-button', 'type': 'button', 'onclick': this.showTab.bind(this, 'clients') }, 'すべて見る →') ]), refs.recentClients ])
		];
	},

	statCard: function(symbol, label, value, caption, color) {
		return E('div', { 'class': 'uf-card uf-stat ' + color }, [ E('div', { 'class': 'uf-stat__top' }, [ E('span', { 'class': 'uf-stat__icon', 'aria-hidden': 'true' }, symbol), E('span', { 'class': 'uf-stat__caption' }, caption) ]), E('div', { 'class': 'uf-stat__label' }, label), value ]);
	},

	renderClientsPage: function() {
		var self = this;
		this.refs.clientCount = E('span', { 'class': 'uf-count' });
		this.refs.clientRows = E('tbody');
		return [
			E('div', { 'class': 'uf-heading' }, [ E('div', {}, [ E('div', { 'class': 'uf-eyebrow' }, 'DEVICES'), E('h1', {}, '端末'), E('p', {}, 'DHCPでアドレスを取得した端末の一覧です。') ]) ]),
			E('div', { 'class': 'uf-card uf-clients-card' }, [
				E('div', { 'class': 'uf-card__head uf-clients-head' }, [ E('div', {}, [ E('div', { 'class': 'uf-card__eyebrow' }, 'DHCP LEASES'), E('h2', {}, [ '割り当て中の端末 ', this.refs.clientCount ]) ]), E('input', { 'class': 'uf-search', 'type': 'search', 'placeholder': '名前・IP・MACで検索', 'aria-label': '端末を検索', 'oninput': function(ev) { self.search = ev.target.value.toLowerCase(); self.renderClientRows(); } }) ]),
				E('div', { 'class': 'uf-table-wrap' }, E('table', { 'class': 'uf-table' }, [ E('thead', {}, E('tr', {}, [ E('th', {}, '端末'), E('th', {}, 'IP アドレス'), E('th', {}, 'MAC アドレス'), E('th', {}, 'リース残り時間') ])), this.refs.clientRows ]))
			])
		];
	},

	showTab: function(tab) {
		var clients = tab === 'clients';
		this.refs.overview.style.display = clients ? 'none' : '';
		this.refs.clientsPage.style.display = clients ? '' : 'none';
		this.refs.navOverview.classList.toggle('is-active', !clients);
		this.refs.navClients.classList.toggle('is-active', clients);
	},

	refreshTraffic: function() {
		if (this.refreshing) return Promise.resolve();
		this.refreshing = true;
		var self = this;
		return Promise.all([ L.resolveDefault(callInterfaces(), null), L.resolveDefault(callInfo(), null) ]).then(function(data) {
			if (Array.isArray(data[0])) {
				self.interfaces = data[0];
				self.interfacesLoaded = true;
			} else self.interfacesLoaded = false;
			if (data[1]) self.info = data[1];
			self.wan = model.selectWan(self.interfaces);
			var name = model.deviceName(self.wan);
			if (name !== self.currentDevice) {
				self.currentDevice = name;
				self.previous = null;
				self.history = [];
			}
			if (!name || !self.wan.up) {
				self.rxRate = 0;
				self.txRate = 0;
				self.totalRx = null;
				self.totalTx = null;
				return;
			}
			return callDevice(name).then(function(device) {
				var stats = device && device.statistics;
				if (!stats) {
					self.previous = null;
					self.totalRx = null;
					self.totalTx = null;
					return;
				}
				var measured = model.sample(self.previous, stats, Date.now());
				self.previous = measured.current;
				self.rxRate = measured.rxRate;
				self.txRate = measured.txRate;
				self.totalRx = stats.rx_bytes;
				self.totalTx = stats.tx_bytes;
				self.history.push({ rx: self.rxRate, tx: self.txRate });
				if (self.history.length > 30) self.history.shift();
			}).catch(function() {
				self.previous = null;
				self.totalRx = null;
				self.totalTx = null;
			});
		}).then(function() {
			self.refreshDisplay();
			self.refreshing = false;
		}).catch(function() {
			self.refreshing = false;
			self.refreshDisplay();
		});
	},

	refreshLeases: function() {
		var self = this;
		return callLeases().then(function(reply) {
			self.leases = model.leases(reply);
			self.refreshDisplay();
			self.renderRecentClients();
			self.renderClientRows();
		}).catch(function() {});
	},

	refreshDisplay: function() {
		var refs = this.refs;
		var wanUp = !!(this.wan && this.wan.up);
		refs.heroStatus.replaceChildren(dot(!this.interfacesLoaded ? '状態を取得できません' : wanUp ? 'WAN接続中' : 'WAN未接続', wanUp));
		text(refs.wanName, this.wan ? this.wan.interface + (model.deviceName(this.wan) ? ' · ' + model.deviceName(this.wan) : '') : '未設定');
		text(refs.wanIp, model.firstAddress(this.wan));
		text(refs.download, this.totalRx == null ? '—' : model.formatRate(this.rxRate));
		text(refs.upload, this.totalTx == null ? '—' : model.formatRate(this.txRate));
		text(refs.chartDownload, this.totalRx == null ? '—' : model.formatRate(this.rxRate));
		text(refs.chartUpload, this.totalTx == null ? '—' : model.formatRate(this.txRate));
		text(refs.deviceCount, this.leases.length);
		text(refs.uptime, this.info.uptime == null ? '—' : model.formatUptime(this.info.uptime));
		text(refs.memoryValue, this.info.memory ? model.memoryPercent(this.info.memory) + '%' : '—');
		refs.memoryBar.style.width = this.info.memory ? model.memoryPercent(this.info.memory) + '%' : '0%';
		text(refs.load, Array.isArray(this.info.load) ? (this.info.load[0] / 65535).toFixed(2) : '—');
		text(refs.totalDownload, this.totalRx == null ? '—' : model.formatBytes(this.totalRx));
		text(refs.totalUpload, this.totalTx == null ? '—' : model.formatBytes(this.totalTx));
		text(refs.updated, new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
		this.renderChart();
		this.renderInterfaceRows();
	},

	renderChart: function() {
		var canvas = this.refs.chart;
		var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 760 188');
		svg.setAttribute('preserveAspectRatio', 'none');
		svg.setAttribute('aria-label', '直近のWAN通信速度');
		svg.setAttribute('role', 'img');
		[ 18, 58, 98, 138, 178 ].forEach(function(y) {
			svg.appendChild(svgPath('M0,' + y + ' L760,' + y, '#e9edf4', 'none', '1'));
		});
		var maximum = Math.max(1000, ...this.history.map(function(point) { return Math.max(point.rx, point.tx); })) * 1.2;
		if (this.history.length) {
			svg.appendChild(svgPath(chartPath(this.history, 'rx', maximum, true), 'none', 'rgba(50, 126, 255, .09)', '0'));
			svg.appendChild(svgPath(chartPath(this.history, 'tx', maximum, true), 'none', 'rgba(133, 105, 240, .07)', '0'));
			svg.appendChild(svgPath(chartPath(this.history, 'rx', maximum, false), '#367ef5', 'none', '3'));
			svg.appendChild(svgPath(chartPath(this.history, 'tx', maximum, false), '#8e74e9', 'none', '3'));
		}
		canvas.replaceChildren(svg);
	},

	renderInterfaceRows: function() {
		var interfaces = this.interfaces.filter(function(iface) { return iface.interface !== 'loopback'; });
		this.refs.interfaces.replaceChildren.apply(this.refs.interfaces, interfaces.length ? interfaces.map(function(iface) {
			return E('div', { 'class': 'uf-list-row' }, [ E('span', { 'class': 'uf-list-row__icon' }, '⌁'), E('span', { 'class': 'uf-list-row__body' }, [ E('strong', {}, iface.interface || '—'), E('small', {}, model.firstAddress(iface)) ]), dot(iface.up ? '接続中' : '未接続', !!iface.up) ]);
		}) : [ E('div', { 'class': 'uf-empty' }, 'インターフェース情報がありません') ]);
	},

	renderRecentClients: function() {
		this.refs.recentClients.replaceChildren.apply(this.refs.recentClients, this.leases.length ? this.leases.slice(0, 4).map(function(lease) {
			return E('div', { 'class': 'uf-list-row' }, [ E('span', { 'class': 'uf-avatar' }, lease.name.charAt(0).toUpperCase()), E('span', { 'class': 'uf-list-row__body' }, [ E('strong', {}, lease.name), E('small', {}, lease.mac) ]), E('span', { 'class': 'uf-list-row__ip' }, lease.ip) ]);
		}) : [ E('div', { 'class': 'uf-empty' }, 'DHCPリースはまだありません') ]);
	},

	renderClientRows: function() {
		var search = this.search;
		var rows = this.leases.filter(function(lease) { return !search || (lease.name + ' ' + lease.ip + ' ' + lease.mac).toLowerCase().indexOf(search) !== -1; });
		text(this.refs.clientCount, this.leases.length);
		this.refs.clientRows.replaceChildren.apply(this.refs.clientRows, rows.length ? rows.map(function(lease) {
			return E('tr', {}, [ E('td', {}, [ E('span', { 'class': 'uf-avatar uf-avatar--small' }, lease.name.charAt(0).toUpperCase()), E('strong', {}, lease.name) ]), E('td', {}, lease.ip), E('td', { 'class': 'uf-mono' }, lease.mac), E('td', {}, lease.expires ? model.formatUptime(lease.expires) : '—') ]);
		}) : [ E('tr', {}, E('td', { 'colspan': 4, 'class': 'uf-table-empty' }, search ? '一致する端末はありません' : 'DHCPリースはまだありません')) ]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
