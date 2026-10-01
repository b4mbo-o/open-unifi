const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
class LuCIClass {
	static extend(methods) {
		class Module extends this {}
		Object.assign(Module.prototype, methods);
		return Module;
	}
	static isSubclass(module) {
		return typeof module === 'function' && module.prototype instanceof this;
	}
}
const modelClass = new Function('L', fs.readFileSync(path.join(root, 'htdocs/luci-static/resources/unifi/model.js'), 'utf8'))({ Class: LuCIClass });
const model = new modelClass();

test('model exports a LuCI class for the module loader', () => {
	assert.ok(LuCIClass.isSubclass(modelClass));
	assert.equal(typeof model.selectWan, 'function');
});

test('WAN selection follows the active default route', () => {
	const interfaces = [
		{ interface: 'lan', up: true },
		{ interface: 'uplink', up: true, l3_device: 'pppoe-uplink', route: [ { target: '0.0.0.0', mask: 0 } ] },
		{ interface: 'wan', up: false, device: 'eth0' }
	];
	assert.equal(model.selectWan(interfaces).interface, 'uplink');
	assert.equal(model.deviceName(model.selectWan(interfaces)), 'pppoe-uplink');
	interfaces[2].up = true;
	assert.equal(model.selectWan(interfaces).interface, 'uplink');
});

test('WAN rate is based on elapsed time and resets on a counter rollback', () => {
	const first = model.sample(null, { rx_bytes: 1000, tx_bytes: 2000 }, 1000);
	const second = model.sample(first.current, { rx_bytes: 1001000, tx_bytes: 502000 }, 3000);
	assert.equal(second.rxRate, 500000);
	assert.equal(second.txRate, 250000);
	assert.equal(model.formatRate(second.rxRate), '4.0 Mbps');
	const reset = model.sample(second.current, { rx_bytes: 100, tx_bytes: 200 }, 5000);
	assert.equal(reset.rxRate, 0);
	assert.equal(reset.txRate, 0);
});

test('DHCP leases are safely normalized and memory uses available bytes', () => {
	const leases = model.leases({ dhcp_leases: [
		{ hostname: '*', macaddr: 'aa:bb:cc:dd:ee:ff', ipaddr: '192.168.1.20', expires: 90 },
		{ hostname: 'laptop', macaddr: '11:22:33:44:55:66', ipaddr: '192.168.1.21', expires: 120 }
	] });
	assert.equal(leases.length, 2);
	assert.equal(leases[0].mac, '11:22:33:44:55:66');
	assert.equal(leases[1].name, '名称不明の端末');
	assert.equal(model.memoryPercent({ total: 1000, available: 350 }), 65);
});

test('LuCI view renders the dashboard with RPC data', async () => {
	class Node {
		constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.textContent = ''; this.classList = { toggle() {} }; }
		appendChild(child) { this.children.push(child); return child; }
		replaceChildren(...children) { this.children = children; }
		setAttribute() {}
	}
	function E(tag, attributes, children) {
		const node = new Node(tag);
		if (attributes && attributes.class) node.className = attributes.class;
		if (children != null) node.children = Array.isArray(children) ? children : [ children ];
		return node;
	}
	const responses = {
		'network.interface.dump': [ { interface: 'wan', up: true, l3_device: 'eth0', 'ipv4-address': [ { address: '203.0.113.2' } ] } ],
		'network.device.status': { statistics: { rx_bytes: 1000000, tx_bytes: 500000 } },
		'system.board': { hostname: 'router', model: 'OpenWrt test device' },
		'system.info': { uptime: 3660, load: [ 6553 ], memory: { total: 1000, available: 400 } },
		'luci-rpc.getDHCPLeases': { dhcp_leases: [ { hostname: 'laptop', macaddr: 'aa:bb:cc:dd:ee:ff', ipaddr: '192.168.1.12', expires: 120 } ] }
	};
	const rpc = { declare: ({ object, method }) => () => Promise.resolve(responses[object + '.' + method]) };
	const L = { env: { dispatchpath: [ 'admin', 'unifi', 'traffic' ] }, resolveDefault: (promise, fallback) => promise.catch(() => fallback), url: (...parts) => '/' + parts.join('/'), resource: name => '/luci-static/resources/' + name };
	const poll = { add() {} };
	const document = { createElementNS: (_ns, tag) => new Node(tag) };
	const viewSource = fs.readFileSync(path.join(root, 'htdocs/luci-static/resources/view/unifi/overview.js'), 'utf8');
	const view = new Function('view', 'rpc', 'poll', 'model', 'E', 'L', 'document', viewSource)({ extend: value => value }, rpc, poll, model, E, L, document);
	const data = await view.load();
	const result = view.render(data);
	assert.equal(result.tag, 'div');
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(view.refs.wanIp.textContent, '203.0.113.2');
	assert.equal(view.refs.deviceCount.textContent, '1');
	assert.equal(view.refs.memoryValue.textContent, '60%');
	assert.equal(view.refs.totalDownload.textContent, '1.0 MB');
	assert.equal(view.refs.trafficPage.style.display, '');
	assert.equal(view.refs.overview.style.display, 'none');
});

test('settings view shows OpenWrt values without rendering WiFi credentials', async () => {
	class Node {
		constructor(tag) { this.tag = tag; this.children = []; this.classList = { toggle() {} }; }
		replaceChildren(...children) { this.children = children; }
	}
	function E(tag, attrs, children) {
		const node = new Node(tag);
		node.attrs = attrs || {};
		if (children != null) node.children = Array.isArray(children) ? children : [ children ];
		return node;
	}
	function content(node) {
		if (node == null) return '';
		if (typeof node !== 'object') return String(node);
		return (node.children || []).map(content).join(' ');
	}
	const sections = {
		network: {
			interface: [
				{ '.name': 'wan', proto: 'dhcp', device: 'eth0' },
				{ '.name': 'lan', proto: 'static', device: 'br-lan', ipaddr: '192.168.1.1', netmask: '255.255.255.0' }
			],
			route: [], route6: []
		},
		wireless: { 'wifi-iface': [ { '.name': 'default_radio0', ssid: 'Home WiFi', key: 'secret-do-not-show', encryption: 'sae', network: 'lan', device: 'radio0', mode: 'ap' } ] },
		firewall: { zone: [ { '.name': 'lan', name: 'lan', network: [ 'lan' ], input: 'ACCEPT', output: 'ACCEPT', forward: 'ACCEPT' } ] },
		dhcp: { dhcp: [ { '.name': 'lan', interface: 'lan', ignore: '0' } ] }
	};
	const uci = { load: () => Promise.resolve(), sections: (config, type) => sections[config][type] || [] };
	const rpc = { declare: () => () => Promise.resolve([ { interface: 'wan', up: true, l3_device: 'eth0', 'ipv4-address': [ { address: '203.0.113.4' } ], route: [ { target: '0.0.0.0', mask: 0 } ] } ]) };
	const L = { env: { dispatchpath: [ 'admin', 'unifi', 'settings', 'internet' ] }, resolveDefault: (promise, fallback) => promise.catch(() => fallback), url: (...parts) => '/' + parts.join('/'), resource: name => '/luci-static/resources/' + name };
	const source = fs.readFileSync(path.join(root, 'htdocs/luci-static/resources/view/unifi/settings.js'), 'utf8');
	const view = new Function('view', 'uci', 'rpc', 'model', 'E', 'L', source)({ extend: value => value }, uci, rpc, model, E, L);
	view.render(await view.load());
	assert.equal(view.category, 'internet');
	assert.equal(view.refs.page.children[0].children[0].children[1].children[0], 'Internet');
	view.showCategory('overview');
	assert.equal(view.refs.page.children[0].children.includes(null), false);
	view.showCategory('wifi');
	assert.match(content(view.refs.page), /Home WiFi/);
	assert.doesNotMatch(content(view.refs.page), /secret-do-not-show/);
	view.showCategory('internet');
	assert.match(content(view.refs.page), /203\.0\.113\.4/);
	view.showCategory('networks');
	assert.match(content(view.refs.page), /192\.168\.1\.1/);
});
