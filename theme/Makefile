include $(TOPDIR)/rules.mk

LUCI_TITLE:=OpenUniFi theme for LuCI
LUCI_DEPENDS:=+luci-base +luci-theme-openwrt-2020
LUCI_PKGARCH:=all
PKG_LICENSE:=Apache-2.0
PKG_LICENSE_FILES:=LICENSE

define Package/luci-theme-open-unifi/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	uci -q delete luci.themes.OpenUniFi
	uci commit luci
}
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
