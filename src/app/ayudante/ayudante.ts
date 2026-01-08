import { Component, OnInit, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Aside } from './aside/aside';
import { Main } from './main/main';
import { User, Post, PostApplicant } from '../models/post.model';
import { DatabaseService } from '../services/database';
import { forkJoin, map, switchMap, of, catchError, take, Subscription } from 'rxjs';

// Define interface for the combined data
interface ApplicationWithPost extends PostApplicant {
  postDetails?: Post;
}

declare var lucide: any;
declare var iziToast: any; // <--- Declaramos iziToast para que TS lo reconozca

@Component({
  selector: 'app-ayudante',
  imports: [Aside, Main, CommonModule, FormsModule],
  templateUrl: './ayudante.html',
  styleUrl: './ayudante.css',
})
export class Ayudante implements OnInit {
  private dbService = inject(DatabaseService);
  private cd = inject(ChangeDetectorRef);
  private appsSubscription: Subscription | undefined;
  
  constructor(private db: DatabaseService) {}

  // Logic for white hands
  appliedPostIds = new Set<string>();

  // Data for Contador screen
  myApplications: ApplicationWithPost[] = [];

  ngOnInit(): void {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // --- CONFIGURACIÓN GLOBAL DE IZITOST ---
    // Esto asegura que todos los toasts tengan el mismo estilo base
    if (typeof iziToast !== 'undefined') {
      iziToast.settings({
        timeout: 4000, // Duración por defecto
        resetOnHover: true,
        transitionIn: 'flipInX',
        transitionOut: 'flipOutX',
        position: 'topRight', // Posición estándar
        theme: 'light',
        progressBarColor: '#ADC2A9', // Tu color 'brand-medium'
        imageWidth: 50,
        layout: 2,
        balloon: false,
        close: true,
        closeOnEscape: true,
      });
    }
  }

  private searchTerm: string = "";
  private searchCategory: string = "publicaciones";
  public showLogin = false;
  isSidebarOpen: boolean = false;
  currentScreen = "llamados";
  currentUser: User | undefined = undefined;

  // --- INICIO BLOQUE EDICIÓN ---
  isEditingProfile: boolean = false;

  toggleEdit() {
    this.isEditingProfile = !this.isEditingProfile;
  }

  // --- FUNCIÓN DE GUARDADO CON VALIDACIÓN DE CORREO ---
  saveProfile() {
    if (!this.currentUser) return;

    const emailToCheck = this.currentUser.email.trim();
    console.log("Validando correo:", emailToCheck);

    // 1. Consultamos ambas colecciones (Users y Asociaciones)
    forkJoin({
      userCheck: this.db.getUserByEmail(emailToCheck).pipe(take(1)),
      assocCheck: this.db.getAssociationByEmail(emailToCheck).pipe(take(1))
    }).subscribe((results) => {
      
      const userExists = results.userCheck;
      const assocExists = results.assocCheck;

      // 2. REGLA DE SEGURIDAD
      if (assocExists || (userExists && userExists.uid !== this.currentUser!.uid)) {
        
        // REEMPLAZO DE ALERT CON IZITOAST ERROR
        iziToast.error({
          title: 'Error de Correo',
          message: 'El correo electrónico ya está registrado en otra cuenta.',
          position: 'center', // Alerta importante al centro
          timeout: 5000
        });
        
        console.error("Conflicto de correo detectado.");
        return;

      } else {
        
        // 3. Si pasó la validación, preparamos los datos
        const datosAActualizar = {
          phone: this.currentUser!.phone,
          about: this.currentUser!.about,
          email: emailToCheck
        };

        console.log("Correo válido. Enviando a Firebase...", datosAActualizar);

        // 4. Actualizamos
        this.db.updateUser(this.currentUser!.uid, datosAActualizar)
          .then(() => {
            // REEMPLAZO DE CONSOLE LOG CON IZITOAST SUCCESS
            iziToast.success({
              title: '¡Guardado!',
              message: 'Tu perfil ha sido actualizado correctamente.',
              position: 'topRight'
            });
            
            this.isEditingProfile = false;
          })
          .catch((error) => {
            console.error('Error al actualizar perfil:', error);
            
            // REEMPLAZO DE ALERT DE ERROR
            iziToast.error({
              title: 'Error Técnico',
              message: 'Hubo un problema al guardar. Intenta de nuevo más tarde.',
            });
          });
      }
    });
  }
  // --- FIN BLOQUE EDICIÓN ---

  @Output() category = new EventEmitter<string>();
  @Output() logout = new EventEmitter<void>();

  filterSearch(event: Event) {
    const query = (event.target as HTMLInputElement).value.toLowerCase();
    this.searchTerm = query;
  }

  setcategory(event: Event) {
    this.searchCategory = (event.target as HTMLSelectElement).value;
  }

  getSearch() { return this.searchTerm; }
  getcategory() { return this.searchCategory; }
  setModalLoginTrue() { this.showLogin = true; }
  setModalLoginFalse() { this.showLogin = false; }
  setLoggedPage(event: string) { this.category.emit(event); }

  changeScreen(event: string) {
    this.currentScreen = event;
    setTimeout(() => {
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 100);
  }

  getUser(event: User | undefined) {
    this.currentUser = event;

    if (this.currentUser && this.currentUser.uid) {
      this.loadUserApplications(this.currentUser.uid);
    } else {
      this.myApplications = [];
      this.appliedPostIds.clear();
    }
  }

  loadUserApplications(userId: string) {
    console.log("🔄 Loading applications for user:", userId);

    this.appsSubscription = this.dbService.getUserApplications(userId).pipe(
      switchMap(apps => {
        this.appliedPostIds.clear();
        apps.forEach(app => {
          if (app.postId) this.appliedPostIds.add(app.postId);
        });

        if (apps.length === 0) {
          return of([]);
        }

        const tasks = apps.map(app =>
          this.dbService.getPostById(app.postId).pipe(
            take(1),
            map(post => {
              if (!post) return null;
              return {
                ...app,
                postDetails: post
              } as ApplicationWithPost;
            }),
            catchError(e => {
              console.error(`Error fetching details for post ${app.postId}`, e);
              return of(null);
            })
          )
        );

        return forkJoin(tasks);
      })
    ).subscribe({
      next: (fullData) => {
        const validData = fullData.filter(item => item !== null) as ApplicationWithPost[];
        this.myApplications = validData;
        console.log("✅ Data ready for Contador screen:", this.myApplications);
        this.cd.detectChanges();
        setTimeout(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 100);
      },
      error: (err) => console.error("Error loading user apps:", err)
    });
  }

  // --- REEMPLAZO DE CONFIRM NATIVO POR IZITOAST ---
  async cancelApplication(postId: string) {
    if (!this.currentUser) return;

    // Usamos iziToast.question para un confirm más bonito
    iziToast.question({
      timeout: 20000,
      close: false,
      overlay: true,
      displayMode: 'once',
      id: 'question',
      zindex: 999,
      title: '¿Estás seguro?',
      message: '¿Deseas cancelar esta postulación?',
      position: 'center',
      buttons: [
        ['<button><b>SÍ, CANCELAR</b></button>', async (instance: any, toast: any) => {
          
          // Lógica de cancelación
          instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
          
          try {
            await this.dbService.removeApplicant(postId, this.currentUser!.uid);

            // Actualización optimista de la UI
            this.myApplications = this.myApplications.filter(app => app.postId !== postId);
            this.appliedPostIds.delete(postId);
            this.cd.detectChanges(); 

            iziToast.success({
              title: 'Cancelada',
              message: 'La postulación ha sido eliminada correctamente.',
            });

          } catch (error) {
            console.error("Error cancelling:", error);
            iziToast.error({
              title: 'Error',
              message: 'No se pudo cancelar la postulación.',
            });
          }

        }, true], // true para cerrar al hacer click
        ['<button>NO</button>', (instance: any, toast: any) => {
          instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
        }]
      ]
    });
  }

  getContactLink(phone: string | undefined, title: string | undefined) {
    const safePhone = phone || '521';
    const safeTitle = title || 'tu publicación';
    const text = `Hola, te contacto por "${safeTitle}" en YoMeSumo.`;
    return `https://wa.me/${safePhone}?text=${encodeURIComponent(text)}`;
  }

  logOut() {
    localStorage.removeItem('userid');
    this.logout.emit();
  }
}