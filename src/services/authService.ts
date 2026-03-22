// Lógica para conectar con el backend (API)
import { API_URL } from '../config/api';

export interface User {
  id: number;
  id_personal?: number;
  username?: string;
  email: string;
  role: string;
  roles?: string[];
  nombre: string | null;
}

// Definimos un tipo para la respuesta del login para más claridad
interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
}

export const loginUser = async (username: string, password: string): Promise<LoginResponse> => {
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // Aquí podrías guardar el token que te devuelva el servidor
      // localStorage.setItem('token', data.token);
      return { success: true, message: data.message, token: data.token, user: data.user };
    }
    return { success: false, message: data.message || 'Error desconocido del servidor' };
  } catch (error) {
    console.error("Error de conexión:", error);
    return { success: false, message: 'No se pudo conectar con el servidor.' };
  }
};

export const testConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_URL}/test-db`);
    const data = await response.json();
    if (response.ok) {
      return { success: true, message: data.message };
    }
    return { success: false, message: 'Error en el servidor de base de datos' };
  } catch (error) {
    return { success: false, message: '❌ El servidor backend no está respondiendo (¿está encendido?)' };
  }
};
