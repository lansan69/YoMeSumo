import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  docData,
  collectionData,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  query,
  where,
  increment, // <--- Added this for applicantsCount
  getDocs, 
  limit
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Post, User, Association, PostApplicant } from '../models/post.model';
import { collectionGroup } from '@angular/fire/firestore/lite';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private firestore = inject(Firestore);

  // =================================================================
  // 1. USERS (Collection: 'users')
  // =================================================================

  async saveUser(user: User) {
    const userRef = doc(this.firestore, `users/${user.uid}`);
    return setDoc(userRef, {
      ...user,
      createdAt: serverTimestamp()
    }, { merge: true });
  }

  getUserById(uid: string): Observable<User | undefined> {
    const userRef = doc(this.firestore, `users/${uid}`);
    return docData(userRef, { idField: 'uid' }) as Observable<User>;
  }

  getUserByEmail(email: string): Observable<User | undefined> {
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('email', '==', email));

    // collectionData returns an array. We map to get the first result.
    return collectionData(q, { idField: 'uid' }).pipe(
      map((users: any[]) => users.length > 0 ? (users[0] as User) : undefined)
    );
  }


  // 3. Get by Phone - This requires a Query
  getUserByPhone(phone: string): Observable<User | undefined> {
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('phone', '==', phone));

    return collectionData(q, { idField: 'uid' }).pipe(
      map((users: any[]) => users.length > 0 ? (users[0] as User) : undefined)
    );
  }

  async updateUser(uid: string, data: Partial<User>) {
    const userRef = doc(this.firestore, `users/${uid}`);
    return updateDoc(userRef, data);
  }

  async removeFromFavorites(uid: string, postId: string): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);
    return updateDoc(userRef, {
      favorites: arrayRemove(postId)
    });
  }

  async saveToFavorites(uid: string, postId: string): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);

    // Atomically add the new postId to the "favorites" array.
    // arrayUnion ensures the ID is unique (it won't add duplicates).
    return updateDoc(userRef, {
      favorites: arrayUnion(postId)
    });
  }

  // =================================================================
  // 2. ASSOCIATIONS (Collection: 'asociaciones')
  // =================================================================

  async saveAssociation(association: Association) {
    // Note: Using 'asociaciones' collection as requested
    const assocRef = doc(this.firestore, `asociaciones/${association.id}`);
    return setDoc(assocRef, {
      ...association,
      createdAt: serverTimestamp()
    }, { merge: true });
  }

  getAssociations(): Observable<Association[]> {
    const asocRef = collection(this.firestore, 'asociaciones');
    // Mapping to 'id' because your Association interface uses 'id'
    return collectionData(asocRef, { idField: 'id' }) as Observable<Association[]>;
  }

  getAssociationById(id: string): Observable<Association | undefined> {
    const assocRef = doc(this.firestore, `asociaciones/${id}`);
    return docData(assocRef, { idField: 'id' }) as Observable<Association>;
  }

  async updateAssociation(id: string, data: Partial<Association>) {
    const assocRef = doc(this.firestore, `asociaciones/${id}`);
    return updateDoc(assocRef, data);
  }

  // =================================================================
  // 3. POSTS (Collection: 'posts')
  // =================================================================

  async createPost(post: Partial<Post>) {
    const postsRef = collection(this.firestore, 'posts');
    return addDoc(postsRef, {
      ...post,
      status: 'open',
      applicantsCount: 0,
      createdAt: serverTimestamp()
    });
  }

  getPosts(): Observable<Post[]> {
    const postsRef = collection(this.firestore, 'posts');
    return collectionData(postsRef, { idField: 'id' }) as Observable<Post[]>;
  }

  getPostById(postId: string): Observable<Post | undefined> {
    const postRef = doc(this.firestore, `posts/${postId}`);
    return docData(postRef, { idField: 'id' }) as Observable<Post>;
  }

  getPostsByAuthor(authorId: string): Observable<Post[]> {
    const postsRef = collection(this.firestore, 'posts');
    const q = query(postsRef, where('authorId', '==', authorId));
    return collectionData(q, { idField: 'id' }) as Observable<Post[]>;
  }

  async updatePost(postId: string, data: Partial<Post>) {
    const postRef = doc(this.firestore, `posts/${postId}`);
    return updateDoc(postRef, data);
  }

  async deletePost(postId: string) {
    const postRef = doc(this.firestore, `posts/${postId}`);
    return deleteDoc(postRef);
  }

  // =================================================================
  // 4. APPLICANTS (Root Collection: 'applicants')
  // =================================================================

  // 1. ADD APPLICANT (Already updated by you, included for completeness)
  async addApplicant(postId: string, userId: string, applicationData: any) {
    const applicantsCol = collection(this.firestore, 'applicants');
    const postRef = doc(this.firestore, `posts/${postId}`);

    // Use addDoc for Random ID
    await addDoc(applicantsCol, {
      ...applicationData,
      status: 'pending',
      timestamp: serverTimestamp()
    });

    // Increment counter
    await updateDoc(postRef, {
      applicantsCount: increment(1)
    });
  }

  async removeApplicant(postId: string, userId: string) {
    const applicantsRef = collection(this.firestore, 'applicants');
    const postRef = doc(this.firestore, `posts/${postId}`);

    // 1. Find the specific document to delete
    // We query for the application matching this Post AND this User
    const q = query(
      applicantsRef,
      where('postId', '==', postId),
      where('uid', '==', userId),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docToDelete = snapshot.docs[0];

      // 2. Delete the application document
      await deleteDoc(docToDelete.ref);

      // 3. Decrement the counter on the Post
      await updateDoc(postRef, {
        applicantsCount: increment(-1)
      });
    }
  }

  // 2. GET APPLICANTS FOR A SPECIFIC POST
  // (Used by the Post Author to see who applied)
  getApplicantsByPostId(postId: string): Observable<PostApplicant[]> {
    const applicantsRef = collection(this.firestore, 'applicants');

    // Query: "Give me all documents in 'applicants' where postId matches"
    const q = query(applicantsRef, where('postId', '==', postId));

    // We map the random document ID to 'applicationId' field so we can use it to update status later
    return collectionData(q, { idField: 'applicationId' }) as Observable<PostApplicant[]>;
  }

  // 3. GET APPLICATIONS MADE BY A USER
  // (Used to color the hand icon white & show "My Applications" list)
  getUserApplications(userId: string): Observable<PostApplicant[]> {
    const applicantsRef = collection(this.firestore, 'applicants');

    // Query: "Give me all documents where uid matches the current user"
    const q = query(applicantsRef, where('uid', '==', userId));

    return collectionData(q, { idField: 'applicationId' }) as Observable<PostApplicant[]>;
  }

  // 4. CHECK SPECIFIC STATUS (Single Application)
  // We can't use doc() directly anymore because we don't know the Random ID.
  // We must query for it.
  getApplicationStatus(postId: string, userId: string): Observable<PostApplicant | undefined> {
    const applicantsRef = collection(this.firestore, 'applicants');

    const q = query(
      applicantsRef,
      where('postId', '==', postId),
      where('uid', '==', userId)
    );

    return collectionData(q, { idField: 'applicationId' }).pipe(
      map(apps => apps.length > 0 ? (apps[0] as PostApplicant) : undefined)
    );
  }

  // 5. UPDATE STATUS
  // applicantId here refers to the RANDOM DOCUMENT ID (e.g., "7d8s9a..."), not the User ID.
  updateApplicantStatus(applicantId: string, status: 'accepted' | 'rejected' | 'completed') {
    const applicantRef = doc(this.firestore, `applicants/${applicantId}`);
    return updateDoc(applicantRef, { status });
  }


  // =================================================================
  // 5. FAVORITES (Array operations on User document)
  // =================================================================

  async addFavorite(userId: string, postId: string) {
    const userRef = doc(this.firestore, `users/${userId}`);
    return updateDoc(userRef, {
      favorites: arrayUnion(postId)
    });
  }

  async removeFavorite(userId: string, postId: string) {
    const userRef = doc(this.firestore, `users/${userId}`);
    return updateDoc(userRef, {
      favorites: arrayRemove(postId)
    });
  }
}