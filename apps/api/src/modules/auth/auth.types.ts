export type RequestUser = {
  id: string;
  hotelId: string;
  roleId: string;
  roleCode: string;
  permissions: string[];
};

export type AuthenticatedRequest = Request & {
  user: RequestUser;
  headers: Record<string, string | undefined>;
  ip?: string;
};
