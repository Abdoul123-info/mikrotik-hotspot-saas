import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  updateDoc 
} from "firebase/firestore";
import { db } from "../config/firebase";

const COLLECTION_NAME = "routers";

export const routerService = {
  // Add a new router for the current user
  async addRouter(userId, routerData) {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...routerData,
        ownerId: userId,
        createdAt: new Date().toISOString()
      });
      return { id: docRef.id, ...routerData };
    } catch (error) {
      console.error("Error adding router:", error);
      throw error;
    }
  },

  // Get all routers belonging to the current user
  async getRouters(userId) {
    try {
      const q = query(collection(db, COLLECTION_NAME), where("ownerId", "==", userId));
      const querySnapshot = await getDocs(q);
      const routers = [];
      querySnapshot.forEach((doc) => {
        routers.push({ id: doc.id, ...doc.data() });
      });
      return routers;
    } catch (error) {
      console.error("Error getting routers:", error);
      throw error;
    }
  },

  // Update a router configuration
  async updateRouter(routerId, routerData) {
    try {
      const routerRef = doc(db, COLLECTION_NAME, routerId);
      await updateDoc(routerRef, routerData);
      return { id: routerId, ...routerData };
    } catch (error) {
      console.error("Error updating router:", error);
      throw error;
    }
  },

  // Delete a router
  async deleteRouter(routerId) {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, routerId));
      return true;
    } catch (error) {
      console.error("Error deleting router:", error);
      throw error;
    }
  }
};
