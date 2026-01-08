import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnDestroy, ChangeDetectorRef } from '@angular/core'; 
import { Observable, BehaviorSubject, combineLatest, map, Subscription } from 'rxjs';
import { DatabaseService } from '../../services/database';
import { Post, Association, User, PostApplicant } from '../../models/post.model';

// Declaración de iziToast
declare var iziToast: any;

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './main.html',
  styleUrl: './main.css',
})
export class Main implements OnDestroy {
  private dbService = inject(DatabaseService);
  private cd = inject(ChangeDetectorRef);

  // This Set is what makes the icons stay white (Persistent State)
  appliedPostIds = new Set<string>();

  private appsSubscription: Subscription | undefined;

  // Backing field
  private _currentUser: User | undefined;
  selectedPost: Post | null = null;

  // --- 1. THE LOGIC THAT LOADS PERSISTENT DATA ---
  @Input() set currentUser(val: User | undefined) {
    this._currentUser = val;
    this.currentUser$.next(val);

    // Clean up old subscription
    if (this.appsSubscription) {
      this.appsSubscription.unsubscribe();
    }

    // If user is logged in, fetch their history immediately
    if (val && val.uid) {
      this.loadUserApplications(val.uid);
    } else {
      // If logged out, clear the white hands
      this.appliedPostIds.clear();
    }
  }

  get currentUser(): User | undefined {
    return this._currentUser;
  }

  @Input() set favDelimitation(val: boolean) {
    this.favDelimitation$.next(val);
  }

  @Input() set searchterm(val: string) {
    this.searchTerm$.next(val);
  }

  @Input() category: string = '';

  private searchTerm$ = new BehaviorSubject<string>('');
  private favDelimitation$ = new BehaviorSubject<boolean>(false);
  private currentUser$ = new BehaviorSubject<User | undefined>(undefined);

  private allPosts$ = this.dbService.getPosts();
  private allAssoc$ = this.dbService.getAssociations();

  // --- Helpers & Actions ---

  isFavorite(postId: string | undefined): boolean {
    if (!this.currentUser || !this.currentUser.favorites || !postId) return false;
    return this.currentUser.favorites.includes(postId);
  }

  hasApplied(postId: string | undefined): boolean {
    if (!postId) return false;
    return this.appliedPostIds.has(postId);
  }

  async toggleFavorite(post: Post) {
    if (!this.currentUser || !this.currentUser.uid || !post.id) {
      // REEMPLAZO ALERT -> WARNING
      iziToast.warning({
        title: 'Atención',
        message: 'Debes iniciar sesión para guardar favoritos',
        position: 'center'
      });
      return;
    }

    const userId = this.currentUser.uid;
    const postId = post.id;

    try {
      if (this.isFavorite(postId)) {
        await this.dbService.removeFromFavorites(userId, postId);
        iziToast.info({
            title: 'Eliminado',
            message: 'Eliminado de tus favoritos',
            position: 'bottomRight',
            timeout: 2000
        });
      } else {
        await this.dbService.saveToFavorites(userId, postId);
        iziToast.success({
            title: 'Guardado',
            message: 'Añadido a tus favoritos',
            position: 'bottomRight',
            timeout: 2000
        });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }

  async addApplicant(post: Post) {
    // 1. Validation
    if (!this.currentUser || !this.currentUser.uid || !post.id) {
      iziToast.warning({
        title: 'Atención',
        message: 'Debes iniciar sesión para sumarte a una causa.',
        position: 'center'
      });
      return;
    }

    const userId = this.currentUser.uid;
    const postId = post.id;

    // ======================================================
    // CASE A: REMOVE APPLICATION (Un-apply)
    // ======================================================
    if (this.hasApplied(postId)) {
      
      // REEMPLAZO CONFIRM -> QUESTION
      iziToast.question({
        timeout: 20000,
        close: false,
        overlay: true,
        displayMode: 'once',
        id: 'question',
        zindex: 999,
        title: 'Cancelar',
        message: '¿Quieres cancelar tu postulación a esta iniciativa?',
        position: 'center',
        buttons: [
          ['<button><b>SÍ, CANCELAR</b></button>', async (instance: any, toast: any) => {
            instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
            
            try {
              await this.dbService.removeApplicant(postId, userId);
              this.appliedPostIds.delete(postId);
              
              iziToast.success({
                title: 'Cancelado',
                message: 'Ya no estás postulado a esta causa.',
              });
            } catch (error) {
              console.error('Error al cancelar:', error);
            }

          }, true],
          ['<button>NO</button>', (instance: any, toast: any) => {
            instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
          }]
        ]
      });
      return; 
    }

    // ======================================================
    // CASE B: ADD APPLICATION (Apply)
    // ======================================================

    // REEMPLAZO PROMPT -> IZITOAST CON INPUT
    iziToast.show({
        theme: 'light',
        icon: 'icon-person',
        title: 'Mensaje al Organizador',
        message: 'Deja un mensaje opcional:',
        position: 'center',
        overlay: true,
        timeout: false, // No se cierra solo
        close: true,
        inputs: [
            ['<input type="text" placeholder="Hola, me gustaría apoyar...">', 'keyup', function (instance: any, toast: any, input: any, e: any) {
                // No action needed on keyup
            }, true] // true = focus
        ],
        buttons: [
            ['<button><b>ENVIAR</b></button>', async (instance: any, toast: any, button: any, e: any, inputs: any) => {
                
                // Obtener valor del input (inputs[0].value)
                const message = inputs[0].value || "Hola, me gustaría apoyar en esta actividad.";
                instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');

                // Procesar envío
                const applicationData: PostApplicant = {
                    uid: userId,
                    applicantId: userId,
                    postId: postId,
                    helperName: this.currentUser!.displayName || 'Usuario',
                    helperPhone: this.currentUser!.phone || '',
                    helperEmail: this.currentUser!.email || '',
                    message: message,
                    status: 'pending',
                    timestamp: null
                };

                try {
                    await this.dbService.addApplicant(postId, userId, applicationData);
                    this.appliedPostIds.add(postId);
                    
                    iziToast.success({
                        title: '¡Te sumaste!',
                        message: 'Tu solicitud ha sido enviada.',
                    });
                } catch (error) {
                    console.error('Error al postularse:', error);
                    iziToast.error({
                        title: 'Error',
                        message: 'Hubo un error al intentar sumarte.',
                    });
                }
            }],
            ['<button>CANCELAR</button>', (instance: any, toast: any) => {
                instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
            }]
        ]
    });
  }

  // --- 2. THE FUNCTION THAT FETCHES FROM DB ---
  loadUserApplications(userId: string) {
    console.log("🔄 Loading applications for user:", userId);

    this.appsSubscription = this.dbService.getUserApplications(userId).subscribe(
      (apps) => {
        this.appliedPostIds.clear();

        apps.forEach(app => {
          if (app.postId) {
            this.appliedPostIds.add(app.postId);
          }
        });

        console.log("✅ Applications loaded:", this.appliedPostIds);
        this.cd.detectChanges();
      }
    );
  }
  openPostDetails(post: Post) {
    this.selectedPost = post;
  }

  closePostDetails() {
    this.selectedPost = null;
  }

  // --- Pipelines ---

  posts$: Observable<Post[]> = combineLatest([
    this.allPosts$,
    this.searchTerm$,
    this.favDelimitation$,
    this.currentUser$
  ]).pipe(
    map(([posts, term, isFavMode, user]) => {
      let filtered = posts;

      if (isFavMode) {
        if (!user || !user.favorites) {
          return [];
        }
        filtered = filtered.filter(p => p.id && user.favorites.includes(p.id));
      }

      if (!term || term.trim() === '') return filtered;

      const lowerTerm = term.toLowerCase();
      return filtered.filter(post =>
        post.title.toLowerCase().includes(lowerTerm) ||
        post.description.toLowerCase().includes(lowerTerm) ||
        post.authorName.toLowerCase().includes(lowerTerm) ||
        (post.suppliesList && post.suppliesList.some(item =>
          item.toLowerCase().includes(lowerTerm)
        ))
      );
    })
  );

  asoc$: Observable<Association[]> = combineLatest([
    this.allAssoc$,
    this.searchTerm$,
    this.favDelimitation$
  ]).pipe(
    map(([asoc, term, isFavMode]) => {
      if (isFavMode) return [];

      if (!term || term.trim() === '') return asoc;

      const lowerTerm = term.toLowerCase();
      return asoc.filter(aso =>
        aso.nameAssociation.toLowerCase().includes(lowerTerm) ||
        aso.description.toLowerCase().includes(lowerTerm) ||
        aso.email.toLowerCase().includes(lowerTerm) ||
        aso.categoria.toLowerCase().includes(lowerTerm)
      );
    })
  );

  ngOnDestroy() {
    if (this.appsSubscription) {
      this.appsSubscription.unsubscribe();
    }
  }
}