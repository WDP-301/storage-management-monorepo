export type AuthUser = {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  status: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  fullName: string;
  phone: string;
};
