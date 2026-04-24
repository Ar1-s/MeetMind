import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'access_token'

export const storage = {
  getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
  setToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  deleteToken: () => SecureStore.deleteItemAsync(TOKEN_KEY),
}
