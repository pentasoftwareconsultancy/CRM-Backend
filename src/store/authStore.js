// src/store/authStore.js (Ensure logic matches this)

export const useAuthStore = create((set) => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),

    login: async (email, password) => {
        const userData = await authService.login(email, password);
        // At this point, userData should contain the avatar from the backend
        set({ user: userData });
        localStorage.setItem('user', JSON.stringify(userData));
        return userData;
    },

    // updateUser: (updates) => {
    //   set((state) => {
    //     // 'updates' comes from the API response after saving
    //     const updatedUser = { ...state.user, ...updates };
    //     localStorage.setItem('user', JSON.stringify(updatedUser));
    //     return { user: updatedUser };
    //   });
    // },

    // UPDATE THIS FUNCTION TO BE ASYNC
    // updateUser: async (updates) => {
    //   try {
    //     // 1. Send data to the backend database
    //     const updatedUserData = await userService.updateProfile(updates);

    //     // 2. Update the local state with what the backend returned
    //     set((state) => {
    //       const newUserState = { ...state.user, ...updatedUserData };
    //       localStorage.setItem('user', JSON.stringify(newUserState));
    //       return { user: newUserState };
    //     });

    //     return updatedUserData;
    //   } catch (error) {
    //     throw error;
    //   }
    // },

    updateUser: async (updates) => {
        try {
            // 1. Call your API service
            const response = await userService.updateProfile(updates);

            // 2. Update Zustand state with the response from the server
            set((state) => {
                const updatedUser = { ...state.user, ...response };

                // 3. Update LocalStorage so it persists for the current session
                localStorage.setItem('user', JSON.stringify(updatedUser));

                return { user: updatedUser };
            });

            return response;
        } catch (error) {
            console.error("Store update failed:", error);
            throw error;
        }
    },
    logout: () => {
        set({ user: null });
        localStorage.removeItem('user');
    }
}));