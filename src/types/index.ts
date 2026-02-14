import type { Component } from 'vue'

export type UserType = 'admin' | 'student' | 'parent'

export interface NavItem {
  title: string
  path: string
  icon: Component
}

export type SidebarNavConfig = Record<UserType, NavItem[]>
