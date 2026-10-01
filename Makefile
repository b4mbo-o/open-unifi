include $(TOPDIR)/rules.mk

LUCI_TITLE:=UniFi-inspired dashboard for OpenWrt
LUCI_DEPENDS:=+luci-base +rpcd-mod-luci +luci-theme-open-unifi
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
