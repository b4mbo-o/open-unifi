include $(TOPDIR)/rules.mk

LUCI_TITLE:=UniFi-inspired dashboard for OpenWrt
LUCI_DEPENDS:=+luci-base +rpcd-mod-luci
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
