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
  increment // <--- Added this for applicantsCount
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
  // 4. APPLICANTS (Sub-collection: 'posts/{postId}/applicants')
  // =================================================================

  async addApplicant(postId: string, userId: string, applicationData: any) {
    const applicantRef = doc(this.firestore, `applicants/${userId}`);
    const postRef = doc(this.firestore, `posts/${postId}`);

    // 1. Add the applicant document
    await setDoc(applicantRef, {
      ...applicationData,
      status: 'pending',
      timestamp: serverTimestamp()
    });

    // 2. Atomically increment the applicantsCount on the main Post
    await updateDoc(postRef, {
      applicantsCount: increment(1)
    });
  }

  getApplicants(postId: string): Observable<PostApplicant[]> {
    const applicantsRef = collection(this.firestore, `posts/${postId}/applicants`);
    // Using 'uid' here assuming the document ID is the User ID
    return collectionData(applicantsRef, { idField: 'uid' }) as Observable<PostApplicant[]>;
  }

  updateApplicantStatus(applicantId: string, status: 'accepted' | 'rejected' | 'completed') {
    // We target the 'applicants' collection because that is where we read the data from
    const applicantRef = doc(this.firestore, `applicants/${applicantId}`);
    return updateDoc(applicantRef, { status });
  }

  getApplicationStatus(postId: string, userId: string): Observable<PostApplicant | undefined> {
    const applicantRef = doc(this.firestore, `posts/${postId}/applicants/${userId}`);
    return docData(applicantRef) as Observable<PostApplicant>;
  }

  getApplicantsByPostId(postId: string): Observable<PostApplicant[]> {
    const applicantsRef = collection(this.firestore, 'applicants');
    const q = query(applicantsRef, where('postId', '==', postId));
    return collectionData(q, { idField: 'applicantId' }) as Observable<PostApplicant[]>;
  }

  getApplicationsByUser(userId: string): Observable<any[]> {
    const ref = collection(this.firestore, 'applicants'); // Or collectionGroup if subcollection
    // Note: Since your structure is posts/{id}/applicants/{uid}, querying all applications 
    // for a user efficiently requires a Collection Group Index in Firestore.
    // For now, we will assume you have a way to get them, or we use the 'applicants' collection strategy.

    // *Simple Alternative for Client-Side visual check:*
    // If you don't have a collectionGroup query set up, the visual check might need 
    // to happen differently. Assuming you have the method from the previous step:
    const q = query(collectionGroup(this.firestore, 'applicants'), where('uid', '==', userId));
    return collectionData(q, { idField: 'applicantId' });
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