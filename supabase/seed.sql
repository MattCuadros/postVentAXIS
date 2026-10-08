insert into zones (id,name,code) values
('z-centro','Postventa Centro','C'),
('z-sur','Postventa Sur','S'),
('z-austral','Postventa Austral','A');

insert into users (id,name,email,phone,role,active) values
('u-admin','Carolina Fuentes','admin@demo.cl','+56 9 1111 1111','ADMIN','true'),
('u-enc-centro','Rodrigo Pérez','rperez@demo.cl','+56 9 2222 2222','ENCARGADO','true'),
('u-enc-sur','Valentina Rojas','vrojas@demo.cl','+56 9 3333 3333','ENCARGADO','true'),
('u-prop-1','Andrés Muñoz','amunoz@correo.cl','+56 9 4444 4444','PROPIETARIO','true'),
('u-prop-2','Francisca Soto','fsoto@correo.cl','+56 9 5555 5555','PROPIETARIO','true'),
('u-prop-3','Tomás Herrera','therrera@correo.cl','+56 9 5656 5656','PROPIETARIO','true'),
('u-prop-4','Camila Reyes','creyes@correo.cl','+56 9 5757 5757','PROPIETARIO','true'),
('u-admin-obra','Gonzalo Ibáñez','gibanez@demo.cl','+56 9 4545 4545','ADMIN_OBRA','true'),
('u-enc-austral','Viviana Hernández','vhernandez@demo.cl','+56 9 3434 3434','ENCARGADO','true'),
('u-prop-5','Ignacio Vera','ivera@correo.cl','+56 9 6161 6161','PROPIETARIO','true'),
('u-prop-6','Paula Contreras','pcontreras@correo.cl','+56 9 6262 6262','PROPIETARIO','true'),
('u-prop-7','Martín Olivares','molivares@correo.cl','+56 9 6363 6363','PROPIETARIO','true'),
('u-prop-8','Diego Muñoz','dmunoz@correo.cl','+56 9 6464 6464','PROPIETARIO','true'),
('u-prop-9','Marcela Díaz','mdiaz@correo.cl','+56 9 6565 6565','PROPIETARIO','true');

insert into user_zones (user_id,zone_id) values
('u-enc-centro','z-centro'),
('u-enc-sur','z-sur'),
('u-enc-sur','z-austral'),
('u-enc-austral','z-austral');

insert into projects (id,name,code,type,zone_id,address,commune,latitude,longitude) values
('p-mirador','Edificio Mirador Central','MIR','HABITACIONAL_ALTURA','z-centro','Av. Ejemplo 1234','Santiago','-33.4489','-70.6693'),
('p-altobulnes','Alto Bulnes III','AB3','HABITACIONAL_EXTENSION','z-austral','Av. Bulnes 3200','Punta Arenas','-53.1395','-70.9138'),
('p-bosque','Condominio Los Robles','ROB','HABITACIONAL_EXTENSION','z-sur','Camino Demo 567','Puerto Montt','-41.4693','-72.9424'),
('p-retail','Centro Comercial Demo','CCD','RETAIL','z-centro','Av. Comercio 450','Santiago','-33.445','-70.66');

insert into user_projects (user_id,project_id) values
('u-admin-obra','p-mirador');

insert into units (id,project_id,type,tower,floor,number,owner_id,provisional_delivery_date,municipal_reception_date,delivery_date) values
('un-1','p-mirador','DEPARTAMENTO','A','7','704','u-prop-1','2026-02-15','2026-03-01','2026-03-15'),
('un-2','p-bosque','CASA',null,null,'12','u-prop-2','2025-10-02','2025-10-20','2025-11-02'),
('un-3','p-mirador','DEPARTAMENTO','B','3','302','u-prop-3','2026-02-15','2026-03-01','2026-03-15'),
('un-ab-g26','p-altobulnes','CASA',null,null,'G26','u-prop-5','2025-11-26','2025-12-10','2025-12-26'),
('un-ab-f3','p-altobulnes','CASA',null,null,'F3','u-prop-6','2022-11-01','2022-11-15','2022-12-01'),
('un-ab-f35','p-altobulnes','CASA',null,null,'F35','u-prop-7','2023-06-01','2023-06-15','2023-07-14'),
('un-4','p-mirador','DEPARTAMENTO','C','1','105','u-prop-4','2026-03-10','2026-03-25','2026-04-10'),
('un-retail-1','p-retail','LOCAL',null,null,'3',null,'2026-03-10','2026-03-25',null),
('un-retail-2','p-retail','LOCAL',null,null,'4',null,'2026-03-10','2026-03-25','2026-04-10');

insert into ticket_categories (id,name) values
('c-sanitarias','Sanitarias'),
('c-ceramicas','Cerámicas'),
('c-ventanas','Ventanas'),
('c-techo','Techo'),
('c-pintura','Pintura'),
('c-puertas','Puertas'),
('c-pisos','Pisos'),
('c-muros','Muros y tabiques'),
('c-calefaccion','Calefacción y gas'),
('c-otros','Otros');

insert into work_crews (id,name,type,contact_name,phone,zone_id) values
('w-int-centro','Cuadrilla Postventa Centro','INTERNO','Jaime Lagos','+56 9 6666 6666','z-centro'),
('w-sub-ventanas','Ventanas del Pacífico Ltda.','SUBCONTRATO','Marcela Vidal','+56 9 7777 7777','z-centro'),
('w-int-austral','Cuadrilla Postventa Austral','INTERNO','Rodrigo Barría','+56 9 9191 9191','z-austral'),
('w-int-sur','Cuadrilla Postventa Sur','INTERNO','Pablo Cárdenas','+56 9 8888 8888','z-sur');

insert into crew_projects (crew_id,project_id) values
('w-int-centro','p-mirador'),
('w-sub-ventanas','p-mirador'),
('w-int-austral','p-altobulnes'),
('w-int-sur','p-bosque');

insert into tickets (id,folio,unit_id,category_id,reported_category_id,room,description,status,created_by_id,encargado_id,crew_id,visit_date,visit_time,scheduled_date,scheduled_time,rejection_reason,created_at,updated_at) values
('t-1','MIR-0001-C','un-1','c-sanitarias','c-sanitarias','Baño principal','Filtración bajo el lavamanos, se moja el mueble.','PROGRAMADO','u-prop-1','u-enc-centro','w-int-centro','2026-09-10',null,'2026-09-25',null,null,'2026-09-02T10:15:00Z','2026-09-12T16:40:00Z'),
('t-2','MIR-0002-C','un-1','c-ventanas','c-ventanas','Living','La ventana corredera no cierra completamente.','EN_RECEPCION','u-prop-1','u-enc-centro','w-sub-ventanas','2026-08-20',null,'2026-09-05',null,null,'2026-08-14T09:00:00Z','2026-09-18T12:00:00Z'),
('t-3','ROB-0001-S','un-2','c-pintura','c-pintura','Dormitorio 2','Pintura descascarada en muro exterior del dormitorio.','INGRESADO','u-prop-2',null,null,null,null,null,null,null,'2026-09-21T18:30:00Z','2026-09-21T18:30:00Z'),
('t-4','MIR-0003-C','un-3','c-sanitarias','c-sanitarias','Cocina','Gotea la llave del lavaplatos aunque esté cerrada.','EN_REVISION','u-prop-3','u-enc-centro',null,null,null,null,null,null,'2026-09-21T13:10:00Z','2026-09-22T09:00:00Z'),
('t-5','MIR-0004-C','un-4','c-ceramicas','c-ceramicas','Baño principal','Cerámica del piso de la ducha suelta y con fisura.','ASIGNADO','u-prop-4','u-enc-centro','w-int-centro',null,null,null,null,null,'2026-09-17T20:45:00Z','2026-09-19T10:00:00Z'),
('t-6','MIR-0005-C','un-3','c-puertas','c-puertas','Dormitorio principal','La puerta roza el piso y cuesta cerrarla.','CERRADO','u-prop-3','u-enc-centro','w-int-centro','2026-08-25',null,'2026-09-01',null,null,'2026-08-20T11:00:00Z','2026-09-08T17:00:00Z');





insert into unit_responsibles (id,unit_id,user_id,relation,relation_note,can_sign_conformity,created_at,created_by_id) values
('ur-1','un-1','u-prop-8','FAMILIAR','hijo','true','2026-01-10T09:00:00Z','u-enc-centro'),
('ur-2','un-1','u-prop-9','ADMIN_COMITE',null,'true','2026-01-10T09:05:00Z','u-enc-centro'),
('ur-3','un-2','u-prop-9','ADMIN_COMITE',null,'true','2026-01-12T11:00:00Z','u-enc-sur');

insert into ticket_status_history (id,ticket_id,from_status,to_status,changed_by_id,comment,actor_capacity,created_at) values
('h-1','t-1',null,'INGRESADO','u-prop-1',null,'Titular','2026-09-02T10:15:00Z'),
('h-2','t-1','INGRESADO','EN_REVISION','u-enc-centro',null,null,'2026-09-03T08:30:00Z'),
('h-3','t-1','EN_REVISION','ASIGNADO','u-enc-centro','Cuadrilla interna.',null,'2026-09-03T09:00:00Z'),
('h-4','t-1','ASIGNADO','VISITA_INSPECTIVA','u-enc-centro','Sifón mal sellado.',null,'2026-09-10T11:20:00Z'),
('h-5','t-1','VISITA_INSPECTIVA','PROGRAMADO','u-enc-centro','Coordinado con propietario.',null,'2026-09-12T16:40:00Z'),
('h-6','t-2',null,'INGRESADO','u-prop-1',null,'Titular','2026-08-14T09:00:00Z'),
('h-7','t-2','INGRESADO','EN_REVISION','u-enc-centro',null,null,'2026-08-16T10:00:00Z'),
('h-8','t-2','EN_REVISION','ASIGNADO','u-enc-centro','Subcontrato de ventanas.',null,'2026-08-18T11:30:00Z'),
('h-9','t-2','ASIGNADO','VISITA_INSPECTIVA','u-enc-centro','Riel desalineado.',null,'2026-08-20T15:00:00Z'),
('h-10','t-2','VISITA_INSPECTIVA','PROGRAMADO','u-enc-centro',null,null,'2026-09-02T09:00:00Z'),
('h-11','t-2','PROGRAMADO','EN_EJECUCION','u-enc-centro',null,null,'2026-09-05T08:30:00Z'),
('h-12','t-2','EN_EJECUCION','EN_RECEPCION','u-enc-centro','Riel cambiado y regulado.',null,'2026-09-18T12:00:00Z'),
('h-13','t-3',null,'INGRESADO','u-prop-2',null,'Titular','2026-09-21T18:30:00Z'),
('h-14','t-4',null,'INGRESADO','u-prop-3',null,'Titular','2026-09-21T13:10:00Z'),
('h-15','t-4','INGRESADO','EN_REVISION','u-enc-centro',null,null,'2026-09-22T09:00:00Z'),
('h-16','t-5',null,'INGRESADO','u-prop-4',null,'Titular','2026-09-17T20:45:00Z'),
('h-17','t-5','INGRESADO','EN_REVISION','u-enc-centro',null,null,'2026-09-18T08:40:00Z'),
('h-18','t-5','EN_REVISION','ASIGNADO','u-enc-centro',null,null,'2026-09-19T10:00:00Z'),
('h-19','t-6',null,'INGRESADO','u-prop-3',null,'Titular','2026-08-20T11:00:00Z'),
('h-20','t-6','INGRESADO','EN_REVISION','u-enc-centro',null,null,'2026-08-21T09:00:00Z'),
('h-21','t-6','EN_REVISION','ASIGNADO','u-enc-centro',null,null,'2026-08-21T09:30:00Z'),
('h-22','t-6','ASIGNADO','VISITA_INSPECTIVA','u-enc-centro','Bisagras descolgadas, requiere cepillar la hoja.',null,'2026-08-25T15:00:00Z'),
('h-23','t-6','VISITA_INSPECTIVA','PROGRAMADO','u-enc-centro',null,null,'2026-08-26T10:00:00Z'),
('h-24','t-6','PROGRAMADO','EN_EJECUCION','u-enc-centro',null,null,'2026-09-01T09:00:00Z'),
('h-25','t-6','EN_EJECUCION','EN_RECEPCION','u-enc-centro','Puerta cepillada y bisagras reguladas.',null,'2026-09-01T16:00:00Z'),
('h-26','t-6','EN_RECEPCION','CERRADO','u-prop-3',null,'Titular','2026-09-08T17:00:00Z');
