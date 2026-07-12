export interface CommunityApp {
  id: string;
  name: string;
  url: string;
  hasKeys: boolean;
  description: string;
  iconName: string;
  colorClass: string;
  accentColor: string;
}

export interface UserSession {
  email: string;
  name: string;
  avatarUrl?: string;
  token?: string;
  isMock?: boolean;
}
