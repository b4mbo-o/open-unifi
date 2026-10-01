'use strict';

function number(value) {
	var n = Number(value);
	return Number.isFinite(n) && n >= 0 ? n : 0;
}

function hasDefaultRoute(iface) {
	return Array.isArray(iface.route) && iface.route.some(function(route) {
		return route && (route.target === '0.0.0.0' || route.target === '::') && Number(route.mask) === 0;
	});
}

function selectWan(interfaces) {
	var list = Array.isArray(interfaces) ? interfaces : [];
	return list.find(function(iface) { return iface.interface === 'wan' && iface.up && hasDefaultRoute(iface); }) ||
		list.find(function(iface) { return iface.up && hasDefaultRoute(iface); }) ||
		list.find(function(iface) { return iface.interface === 'wan' && iface.up; }) ||
		list.find(function(iface) { return iface.interface === 'wan'; }) || null;
}

function deviceName(iface) {
	return iface ? (iface.l3_device || iface.device || null) : null;
}

function firstAddress(iface) {
	if (!iface) return '—';
	var addresses = iface['ipv4-address'];
	if (Array.isArray(addresses) && addresses[0] && addresses[0].address)
		return addresses[0].address;
	addresses = iface['ipv6-address'];
	return Array.isArray(addresses) && addresses[0] && addresses[0].address ? addresses[0].address : '—';
}

function sample(previous, statistics, timestamp) {
	var rx = number(statistics && statistics.rx_bytes);
	var tx = number(statistics && statistics.tx_bytes);
	var current = { rx: rx, tx: tx, timestamp: timestamp };
	if (!previous || timestamp <= previous.timestamp || rx < previous.rx || tx < previous.tx)
		return { current: current, rxRate: 0, txRate: 0 };
	var seconds = (timestamp - previous.timestamp) / 1000;
	return {
		current: current,
		rxRate: (rx - previous.rx) / seconds,
		txRate: (tx - previous.tx) / seconds
	};
}

function formatBytes(bytes) {
	var units = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
	var value = number(bytes);
	var unit = 0;
	while (value >= 1000 && unit < units.length - 1) {
		value /= 1000;
		unit++;
	}
	return (unit === 0 ? value.toFixed(0) : value.toFixed(value < 10 ? 1 : 0)) + ' ' + units[unit];
}

function formatRate(bytesPerSecond) {
	var bits = number(bytesPerSecond) * 8;
	var units = [ 'bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps' ];
	var unit = 0;
	while (bits >= 1000 && unit < units.length - 1) {
		bits /= 1000;
		unit++;
	}
	return (unit === 0 ? bits.toFixed(0) : bits.toFixed(bits < 10 ? 1 : 0)) + ' ' + units[unit];
}

function formatUptime(seconds) {
	var days = Math.floor(number(seconds) / 86400);
	var hours = Math.floor(number(seconds) % 86400 / 3600);
	var minutes = Math.floor(number(seconds) % 3600 / 60);
	return days ? days + '日 ' + hours + '時間' : hours ? hours + '時間 ' + minutes + '分' : minutes + '分';
}

function memoryPercent(memory) {
	if (!memory || !number(memory.total)) return 0;
	var available = memory.available == null ?
		number(memory.free) + number(memory.buffered) + number(memory.cached) : number(memory.available);
	return Math.max(0, Math.min(100, Math.round((1 - available / number(memory.total)) * 100)));
}

function leases(reply) {
	var rows = reply && Array.isArray(reply.dhcp_leases) ? reply.dhcp_leases : [];
	return rows.filter(function(lease) { return lease && lease.macaddr; }).map(function(lease) {
		return {
			name: lease.hostname && lease.hostname !== '*' ? lease.hostname : '名称不明の端末',
			ip: lease.ipaddr || '—',
			mac: lease.macaddr.toUpperCase(),
			expires: number(lease.expires)
		};
	}).sort(function(a, b) { return a.name.localeCompare(b.name); });
}

return {
	selectWan: selectWan,
	deviceName: deviceName,
	firstAddress: firstAddress,
	sample: sample,
	formatBytes: formatBytes,
	formatRate: formatRate,
	formatUptime: formatUptime,
	memoryPercent: memoryPercent,
	leases: leases
};
