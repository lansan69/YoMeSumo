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
import { Post, User, Association, PostApplicant } from '../models/post.model';

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

  async updateUser(uid: string, data: Partial<User>) {
    const userRef = doc(this.firestore, `users/${uid}`);
    return updateDoc(userRef, data);
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
    const applicantRef = doc(this.firestore, `posts/${postId}/applicants/${userId}`);
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

  async updateApplicantStatus(postId: string, applicantId: string, status: 'accepted' | 'rejected') {
    const applicantRef = doc(this.firestore, `posts/${postId}/applicants/${applicantId}`);
    return updateDoc(applicantRef, { status });
  }

  getApplicationStatus(postId: string, userId: string): Observable<PostApplicant | undefined> {
    const applicantRef = doc(this.firestore, `posts/${postId}/applicants/${userId}`);
    return docData(applicantRef) as Observable<PostApplicant>;
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