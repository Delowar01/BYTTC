
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "academic_sessions": {
                  Row: {
                    "created_at": string,"end_date": string | null,"id": string,"is_active": boolean,"name": string,"start_date": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_date"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"start_date"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"end_date"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"start_date"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"id": number,"new_data": Json | null,"occurred_at": string,"old_data": Json | null,"reason": string | null,"record_id": string | null,"table_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"id"?: never,"new_data"?: Json | null,"occurred_at"?: string,"old_data"?: Json | null,"reason"?: string | null,"record_id"?: string | null,"table_name"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"id"?: never,"new_data"?: Json | null,"occurred_at"?: string,"old_data"?: Json | null,"reason"?: string | null,"record_id"?: string | null,"table_name"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"banners": {
                  Row: {
                    "created_at": string,"id": string,"image_url": string | null,"is_active": boolean,"link_label_bn": string | null,"link_label_en": string | null,"link_url": string | null,"sort_order": number,"subtitle_bn": string | null,"subtitle_en": string | null,"title_bn": string | null,"title_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"link_label_bn"?: string | null,"link_label_en"?: string | null,"link_url"?: string | null,"sort_order"?: number,"subtitle_bn"?: string | null,"subtitle_en"?: string | null,"title_bn"?: string | null,"title_en": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"link_label_bn"?: string | null,"link_label_en"?: string | null,"link_url"?: string | null,"sort_order"?: number,"subtitle_bn"?: string | null,"subtitle_en"?: string | null,"title_bn"?: string | null,"title_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"certificates": {
                  Row: {
                    "certificate_no": string,"created_at": string,"id": string,"institute_id": string,"issued_at": string,"issued_by": string | null,"needs_reissue": boolean,"result_id": string,"revoke_reason": string | null,"revoked_at": string | null,"revoked_by": string | null,"snapshot": NonNullable<Json>,"status": string,"student_id": string,"supersedes_id": string | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "certificate_no": string,"created_at"?: string,"id"?: string,"institute_id": string,"issued_at"?: string,"issued_by"?: string | null,"needs_reissue"?: boolean,"result_id": string,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"snapshot"?: NonNullable<Json>,"status"?: string,"student_id": string,"supersedes_id"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "certificate_no"?: string,"created_at"?: string,"id"?: string,"institute_id"?: string,"issued_at"?: string,"issued_by"?: string | null,"needs_reissue"?: boolean,"result_id"?: string,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"snapshot"?: NonNullable<Json>,"status"?: string,"student_id"?: string,"supersedes_id"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "certificates_institute_id_fkey"
      columns: ["institute_id"]
isOneToOne: false
      referencedRelation: "institutes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certificates_result_id_fkey"
      columns: ["result_id"]
isOneToOne: false
      referencedRelation: "results"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certificates_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certificates_supersedes_id_fkey"
      columns: ["supersedes_id"]
isOneToOne: false
      referencedRelation: "certificates"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_messages": {
                  Row: {
                    "created_at": string,"email": string | null,"id": string,"is_read": boolean,"message": string,"name": string,"phone": string | null,"subject": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"is_read"?: boolean,"message": string,"name": string,"phone"?: string | null,"subject"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"is_read"?: boolean,"message"?: string,"name"?: string,"phone"?: string | null,"subject"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"courses": {
                  Row: {
                    "code": string,"created_at": string,"description_bn": string | null,"description_en": string | null,"duration_months": number | null,"fee": number | null,"id": string,"image_url": string | null,"is_published": boolean,"sort_order": number,"summary_bn": string | null,"summary_en": string | null,"title_bn": string | null,"title_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"description_bn"?: string | null,"description_en"?: string | null,"duration_months"?: number | null,"fee"?: number | null,"id"?: string,"image_url"?: string | null,"is_published"?: boolean,"sort_order"?: number,"summary_bn"?: string | null,"summary_en"?: string | null,"title_bn"?: string | null,"title_en": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description_bn"?: string | null,"description_en"?: string | null,"duration_months"?: number | null,"fee"?: number | null,"id"?: string,"image_url"?: string | null,"is_published"?: boolean,"sort_order"?: number,"summary_bn"?: string | null,"summary_en"?: string | null,"title_bn"?: string | null,"title_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"exams": {
                  Row: {
                    "code": string,"course_id": string,"created_at": string,"exam_date": string | null,"grade_scale_code": string,"id": string,"is_active": boolean,"name": string,"pass_marks": number,"practical_full_marks": number,"session_id": string,"theory_full_marks": number,"updated_at": string,"viva_full_marks": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"course_id": string,"created_at"?: string,"exam_date"?: string | null,"grade_scale_code"?: string,"id"?: string,"is_active"?: boolean,"name": string,"pass_marks"?: number,"practical_full_marks"?: number,"session_id": string,"theory_full_marks"?: number,"updated_at"?: string,"viva_full_marks"?: number
                  }
                  Update: {
                    "code"?: string,"course_id"?: string,"created_at"?: string,"exam_date"?: string | null,"grade_scale_code"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"pass_marks"?: number,"practical_full_marks"?: number,"session_id"?: string,"theory_full_marks"?: number,"updated_at"?: string,"viva_full_marks"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "exams_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exams_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"grade_rules": {
                  Row: {
                    "created_at": string,"grade": string,"grade_point": number,"id": number,"min_percent": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"grade": string,"grade_point": number,"id"?: number,"min_percent": number
                  }
                  Update: {
                    "created_at"?: string,"grade"?: string,"grade_point"?: number,"id"?: number,"min_percent"?: number
                  }
                  Relationships: [
                    
                  ]
                },"grade_scales": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"id": string,"is_current": boolean,"max_point": number,"name": string,"rules": NonNullable<Json>,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_current"?: boolean,"max_point": number,"name": string,"rules": NonNullable<Json>,"version"?: number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_current"?: boolean,"max_point"?: number,"name"?: string,"rules"?: NonNullable<Json>,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"import_batches": {
                  Row: {
                    "committed_at": string | null,"committed_by": string | null,"created_at": string,"created_by": string | null,"error_rows": number,"errors": NonNullable<Json>,"failure_reason": string | null,"file_name": string,"file_path": string | null,"file_sha256": string | null,"file_size": number | null,"id": string,"institute_id": string | null,"kind": string,"notes": string | null,"payload": NonNullable<Json>,"published_at": string | null,"published_by": string | null,"rolled_back_at": string | null,"rolled_back_by": string | null,"status": Database["public"]['Enums']["batch_status"],"summary": Json | null,"total_rows": number,"unpublished_at": string | null,"valid_rows": number
                  }
                  ComputedFields: never
                  Insert: {
                    "committed_at"?: string | null,"committed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"error_rows"?: number,"errors"?: NonNullable<Json>,"failure_reason"?: string | null,"file_name": string,"file_path"?: string | null,"file_sha256"?: string | null,"file_size"?: number | null,"id"?: string,"institute_id"?: string | null,"kind": string,"notes"?: string | null,"payload"?: NonNullable<Json>,"published_at"?: string | null,"published_by"?: string | null,"rolled_back_at"?: string | null,"rolled_back_by"?: string | null,"status"?: Database["public"]['Enums']["batch_status"],"summary"?: Json | null,"total_rows"?: number,"unpublished_at"?: string | null,"valid_rows"?: number
                  }
                  Update: {
                    "committed_at"?: string | null,"committed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"error_rows"?: number,"errors"?: NonNullable<Json>,"failure_reason"?: string | null,"file_name"?: string,"file_path"?: string | null,"file_sha256"?: string | null,"file_size"?: number | null,"id"?: string,"institute_id"?: string | null,"kind"?: string,"notes"?: string | null,"payload"?: NonNullable<Json>,"published_at"?: string | null,"published_by"?: string | null,"rolled_back_at"?: string | null,"rolled_back_by"?: string | null,"status"?: Database["public"]['Enums']["batch_status"],"summary"?: Json | null,"total_rows"?: number,"unpublished_at"?: string | null,"valid_rows"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_batches_institute_id_fkey"
      columns: ["institute_id"]
isOneToOne: false
      referencedRelation: "institutes"
      referencedColumns: ["id"]
    }
                  ]
                },"institute_courses": {
                  Row: {
                    "assigned_at": string,"assigned_by": string | null,"course_id": string,"institute_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"course_id": string,"institute_id": string
                  }
                  Update: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"course_id"?: string,"institute_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "institute_courses_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "institute_courses_institute_id_fkey"
      columns: ["institute_id"]
isOneToOne: false
      referencedRelation: "institutes"
      referencedColumns: ["id"]
    }
                  ]
                },"institutes": {
                  Row: {
                    "address": string | null,"applicant_email": string | null,"applicant_name": string | null,"applicant_phone": string | null,"application_note": string | null,"applied_at": string | null,"approved_at": string | null,"approved_by": string | null,"code": string,"created_at": string,"district": string | null,"documents": (string)[],"email": string | null,"established_year": number | null,"head_name": string | null,"id": string,"name_bn": string | null,"name_en": string,"phone": string | null,"registration_no": string | null,"remarks": string | null,"requested_courses": (string)[],"status": Database["public"]['Enums']["institute_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"applicant_email"?: string | null,"applicant_name"?: string | null,"applicant_phone"?: string | null,"application_note"?: string | null,"applied_at"?: string | null,"approved_at"?: string | null,"approved_by"?: string | null,"code": string,"created_at"?: string,"district"?: string | null,"documents"?: (string)[],"email"?: string | null,"established_year"?: number | null,"head_name"?: string | null,"id"?: string,"name_bn"?: string | null,"name_en": string,"phone"?: string | null,"registration_no"?: string | null,"remarks"?: string | null,"requested_courses"?: (string)[],"status"?: Database["public"]['Enums']["institute_status"],"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"applicant_email"?: string | null,"applicant_name"?: string | null,"applicant_phone"?: string | null,"application_note"?: string | null,"applied_at"?: string | null,"approved_at"?: string | null,"approved_by"?: string | null,"code"?: string,"created_at"?: string,"district"?: string | null,"documents"?: (string)[],"email"?: string | null,"established_year"?: number | null,"head_name"?: string | null,"id"?: string,"name_bn"?: string | null,"name_en"?: string,"phone"?: string | null,"registration_no"?: string | null,"remarks"?: string | null,"requested_courses"?: (string)[],"status"?: Database["public"]['Enums']["institute_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"lookup_attempts": {
                  Row: {
                    "client_key": string,"created_at": string,"id": number,"kind": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_key": string,"created_at"?: string,"id"?: never,"kind": string
                  }
                  Update: {
                    "client_key"?: string,"created_at"?: string,"id"?: never,"kind"?: string
                  }
                  Relationships: [
                    
                  ]
                },"menu_items": {
                  Row: {
                    "created_at": string,"href": string,"id": string,"is_active": boolean,"label_bn": string | null,"label_en": string,"location": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"href": string,"id"?: string,"is_active"?: boolean,"label_bn"?: string | null,"label_en": string,"location": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"href"?: string,"id"?: string,"is_active"?: boolean,"label_bn"?: string | null,"label_en"?: string,"location"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notices": {
                  Row: {
                    "attachment_url": string | null,"body_bn": string | null,"body_en": string | null,"created_at": string,"id": string,"is_pinned": boolean,"is_published": boolean,"published_at": string,"title_bn": string | null,"title_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_url"?: string | null,"body_bn"?: string | null,"body_en"?: string | null,"created_at"?: string,"id"?: string,"is_pinned"?: boolean,"is_published"?: boolean,"published_at"?: string,"title_bn"?: string | null,"title_en": string,"updated_at"?: string
                  }
                  Update: {
                    "attachment_url"?: string | null,"body_bn"?: string | null,"body_en"?: string | null,"created_at"?: string,"id"?: string,"is_pinned"?: boolean,"is_published"?: boolean,"published_at"?: string,"title_bn"?: string | null,"title_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pages": {
                  Row: {
                    "body_bn": string | null,"body_en": string | null,"created_at": string,"id": string,"is_published": boolean,"is_system": boolean,"og_image_url": string | null,"seo_description_bn": string | null,"seo_description_en": string | null,"seo_title_bn": string | null,"seo_title_en": string | null,"slug": string,"title_bn": string | null,"title_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_bn"?: string | null,"body_en"?: string | null,"created_at"?: string,"id"?: string,"is_published"?: boolean,"is_system"?: boolean,"og_image_url"?: string | null,"seo_description_bn"?: string | null,"seo_description_en"?: string | null,"seo_title_bn"?: string | null,"seo_title_en"?: string | null,"slug": string,"title_bn"?: string | null,"title_en": string,"updated_at"?: string
                  }
                  Update: {
                    "body_bn"?: string | null,"body_en"?: string | null,"created_at"?: string,"id"?: string,"is_published"?: boolean,"is_system"?: boolean,"og_image_url"?: string | null,"seo_description_bn"?: string | null,"seo_description_en"?: string | null,"seo_title_bn"?: string | null,"seo_title_en"?: string | null,"slug"?: string,"title_bn"?: string | null,"title_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string | null,"id": string,"institute_id": string | null,"is_active": boolean,"role": Database["public"]['Enums']["app_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"institute_id"?: string | null,"is_active"?: boolean,"role": Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"institute_id"?: string | null,"is_active"?: boolean,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_institute_id_fkey"
      columns: ["institute_id"]
isOneToOne: false
      referencedRelation: "institutes"
      referencedColumns: ["id"]
    }
                  ]
                },"results": {
                  Row: {
                    "batch_id": string | null,"created_at": string,"created_by": string | null,"display_published_on": string | null,"exam_id": string,"first_published_at": string | null,"full_marks": number | null,"grade": string | null,"grade_override": string | null,"grade_point": number | null,"grade_point_override": number | null,"grade_scale_id": string | null,"id": string,"institute_id": string,"is_pass": boolean | null,"percentage": number | null,"practical_marks": number | null,"published_at": string | null,"published_by": string | null,"remarks": string | null,"status": Database["public"]['Enums']["result_status"],"student_id": string,"theory_marks": number | null,"total_marks": number | null,"updated_at": string,"updated_by": string | null,"version": number,"viva_marks": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"display_published_on"?: string | null,"exam_id": string,"first_published_at"?: string | null,"full_marks"?: number | null,"grade"?: string | null,"grade_override"?: string | null,"grade_point"?: number | null,"grade_point_override"?: number | null,"grade_scale_id"?: string | null,"id"?: string,"institute_id": string,"is_pass"?: boolean | null,"percentage"?: number | null,"practical_marks"?: number | null,"published_at"?: string | null,"published_by"?: string | null,"remarks"?: string | null,"status"?: Database["public"]['Enums']["result_status"],"student_id": string,"theory_marks"?: number | null,"total_marks"?: number | null,"updated_at"?: string,"updated_by"?: string | null,"version"?: number,"viva_marks"?: number | null
                  }
                  Update: {
                    "batch_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"display_published_on"?: string | null,"exam_id"?: string,"first_published_at"?: string | null,"full_marks"?: number | null,"grade"?: string | null,"grade_override"?: string | null,"grade_point"?: number | null,"grade_point_override"?: number | null,"grade_scale_id"?: string | null,"id"?: string,"institute_id"?: string,"is_pass"?: boolean | null,"percentage"?: number | null,"practical_marks"?: number | null,"published_at"?: string | null,"published_by"?: string | null,"remarks"?: string | null,"status"?: Database["public"]['Enums']["result_status"],"student_id"?: string,"theory_marks"?: number | null,"total_marks"?: number | null,"updated_at"?: string,"updated_by"?: string | null,"version"?: number,"viva_marks"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "results_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "import_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "results_exam_id_fkey"
      columns: ["exam_id"]
isOneToOne: false
      referencedRelation: "exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "results_grade_scale_id_fkey"
      columns: ["grade_scale_id"]
isOneToOne: false
      referencedRelation: "grade_scales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "results_institute_id_fkey"
      columns: ["institute_id"]
isOneToOne: false
      referencedRelation: "institutes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "results_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"site_settings": {
                  Row: {
                    "address_bn": string | null,"address_en": string | null,"cert_signatory_left": string,"cert_signatory_right": string,"cert_title_en": string,"disclaimer_bn": string | null,"disclaimer_en": string | null,"email": string | null,"facebook_url": string | null,"footer_text_bn": string | null,"footer_text_en": string | null,"id": number,"logo_url": string | null,"map_embed_url": string | null,"office_hours_bn": string | null,"office_hours_en": string | null,"og_image_url": string | null,"org_name_bn": string | null,"org_name_en": string,"org_registration_no": string | null,"phone": string | null,"seo_description_bn": string | null,"seo_description_en": string | null,"seo_title_bn": string | null,"seo_title_en": string | null,"short_name": string | null,"tagline_bn": string | null,"tagline_en": string | null,"updated_at": string,"youtube_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address_bn"?: string | null,"address_en"?: string | null,"cert_signatory_left"?: string,"cert_signatory_right"?: string,"cert_title_en"?: string,"disclaimer_bn"?: string | null,"disclaimer_en"?: string | null,"email"?: string | null,"facebook_url"?: string | null,"footer_text_bn"?: string | null,"footer_text_en"?: string | null,"id"?: number,"logo_url"?: string | null,"map_embed_url"?: string | null,"office_hours_bn"?: string | null,"office_hours_en"?: string | null,"og_image_url"?: string | null,"org_name_bn"?: string | null,"org_name_en": string,"org_registration_no"?: string | null,"phone"?: string | null,"seo_description_bn"?: string | null,"seo_description_en"?: string | null,"seo_title_bn"?: string | null,"seo_title_en"?: string | null,"short_name"?: string | null,"tagline_bn"?: string | null,"tagline_en"?: string | null,"updated_at"?: string,"youtube_url"?: string | null
                  }
                  Update: {
                    "address_bn"?: string | null,"address_en"?: string | null,"cert_signatory_left"?: string,"cert_signatory_right"?: string,"cert_title_en"?: string,"disclaimer_bn"?: string | null,"disclaimer_en"?: string | null,"email"?: string | null,"facebook_url"?: string | null,"footer_text_bn"?: string | null,"footer_text_en"?: string | null,"id"?: number,"logo_url"?: string | null,"map_embed_url"?: string | null,"office_hours_bn"?: string | null,"office_hours_en"?: string | null,"og_image_url"?: string | null,"org_name_bn"?: string | null,"org_name_en"?: string,"org_registration_no"?: string | null,"phone"?: string | null,"seo_description_bn"?: string | null,"seo_description_en"?: string | null,"seo_title_bn"?: string | null,"seo_title_en"?: string | null,"short_name"?: string | null,"tagline_bn"?: string | null,"tagline_en"?: string | null,"updated_at"?: string,"youtube_url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"students": {
                  Row: {
                    "address": string | null,"course_duration_override": string | null,"course_id": string,"created_at": string,"created_by": string | null,"date_of_birth": string | null,"district": string | null,"email": string | null,"enrollment_date": string | null,"father_name": string | null,"gender": string | null,"id": string,"institute_id": string,"mother_name": string | null,"name_bn": string | null,"name_en": string,"national_id": string | null,"passing_year": number | null,"passport_no": string | null,"phone": string | null,"photo_path": string | null,"registration_no": string,"roll_no": string,"session_id": string,"status": Database["public"]['Enums']["student_status"],"thana": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"course_duration_override"?: string | null,"course_id": string,"created_at"?: string,"created_by"?: string | null,"date_of_birth"?: string | null,"district"?: string | null,"email"?: string | null,"enrollment_date"?: string | null,"father_name"?: string | null,"gender"?: string | null,"id"?: string,"institute_id": string,"mother_name"?: string | null,"name_bn"?: string | null,"name_en": string,"national_id"?: string | null,"passing_year"?: number | null,"passport_no"?: string | null,"phone"?: string | null,"photo_path"?: string | null,"registration_no": string,"roll_no"?: string,"session_id": string,"status"?: Database["public"]['Enums']["student_status"],"thana"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"course_duration_override"?: string | null,"course_id"?: string,"created_at"?: string,"created_by"?: string | null,"date_of_birth"?: string | null,"district"?: string | null,"email"?: string | null,"enrollment_date"?: string | null,"father_name"?: string | null,"gender"?: string | null,"id"?: string,"institute_id"?: string,"mother_name"?: string | null,"name_bn"?: string | null,"name_en"?: string,"national_id"?: string | null,"passing_year"?: number | null,"passport_no"?: string | null,"phone"?: string | null,"photo_path"?: string | null,"registration_no"?: string,"roll_no"?: string,"session_id"?: string,"status"?: Database["public"]['Enums']["student_status"],"thana"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "students_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "students_institute_id_fkey"
      columns: ["institute_id"]
isOneToOne: false
      referencedRelation: "institutes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "students_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_publish":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"check_rate_limit":
{ Args: { "p_client_key": string,"p_kind": string,"p_max": number,"p_window": string }; Returns: boolean
                           },
"commit_result_batch":
{ Args: { "p_batch_id": string }; Returns: Json
                           },
"commit_student_batch":
{ Args: { "p_batch_id": string }; Returns: Json
                           },
"correct_result":
{ Args: { "p_id": string,"p_practical": number,"p_reason": string,"p_remarks": string,"p_theory": number }; Returns: Json
                           },
"correct_result_v2":
{ Args: { "p_display_published_on": string,"p_grade_override": string,"p_grade_point_override": number,"p_id": string,"p_practical": number,"p_reason": string,"p_remarks": string,"p_theory": number,"p_viva": number }; Returns: Json
                           },
"current_institute_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"discard_batch":
{ Args: { "p_batch_id": string }; Returns: Json
                           },
"generate_certificate_no":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"generate_registration_no":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"has_role":
{ Args: { "roles": (Database["public"]['Enums']["app_role"])[] }; Returns: boolean
                           },
"identifiers_in_use":
{ Args: { "p_registrations": (string)[],"p_rolls": (string)[] }; Returns: {
              "kind": string,"value": string
            }[]
                           },
"is_backend":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_central":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_cms_editor":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_safe_url":
{ Args: { "u": string }; Returns: boolean
                           },
"issue_certificate_internal":
{ Args: { "p_result_id": string,"p_supersedes"?: string }; Returns: {
              "certificate_no": string,
"created_at": string,
"id": string,
"institute_id": string,
"issued_at": string,
"issued_by": string | null,
"needs_reissue": boolean,
"result_id": string,
"revoke_reason": string | null,
"revoked_at": string | null,
"revoked_by": string | null,
"snapshot": NonNullable<Json>,
"status": string,
"student_id": string,
"supersedes_id": string | null,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "certificates"
        isOneToOne: true
        isSetofReturn: false
      } },
"issue_certificates":
{ Args: { "p_result_ids": (string)[] }; Returns: Json
                           },
"issue_exam_certificates":
{ Args: { "p_exam_id": string }; Returns: Json
                           },
"log_event":
{ Args: { "p_action": string,"p_data"?: Json,"p_reason"?: string,"p_record_id": string,"p_table": string }; Returns: undefined
                           },
"public_institutes":
{ Args: { "p_search"?: string }; Returns: {
              "address": string,"code": string,"district": string,"established_year": number,"name_bn": string,"name_en": string,"phone": string
            }[]
                           },
"public_result_lookup":
{ Args: { "p_registration": string,"p_roll": string }; Returns: {
              "course_code": string,"course_title": string,"exam_code": string,"exam_name": string,"full_marks": number,"grade": string,"grade_point": number,"institute_code": string,"institute_name": string,"is_pass": boolean,"percentage": number,"practical_marks": number,"published_at": string,"registration_no": string,"roll_no": string,"session_name": string,"student_name": string,"student_name_bn": string,"theory_marks": number,"total_marks": number
            }[]
                           },
"public_stats":
{ Args: Record<PropertyKey, never>; Returns: {
              "certified": number,"courses": number,"institutes": number,"students": number
            }[]
                           },
"public_verify_certificate":
{ Args: { "p_certificate_no": string }; Returns: {
              "certificate_no": string,"course_title": string,"grade": string,"grade_point": number,"institute_name": string,"issued_at": string,"registration_no": string,"revoked_at": string,"roll_no": string,"session_name": string,"status": string,"student_name": string,"superseded_by": string
            }[]
                           },
"reissue_certificate":
{ Args: { "p_id": string,"p_reason": string }; Returns: Json
                           },
"report_results":
{ Args: { "p_exam_id"?: string }; Returns: {
              "exam_code": string,"exam_id": string,"exam_name": string,"grade": string,"institute_code": string,"institute_name": string,"is_pass": boolean,"n": number,"status": string
            }[]
                           },
"report_students":
{ Args: Record<PropertyKey, never>; Returns: {
              "course_code": string,"institute_code": string,"institute_name": string,"n": number,"session_name": string,"status": string
            }[]
                           },
"revoke_certificate":
{ Args: { "p_id": string,"p_reason": string }; Returns: Json
                           },
"rollback_result_batch":
{ Args: { "p_batch_id": string,"p_reason": string }; Returns: Json
                           },
"save_grade_scale":
{ Args: { "p_code": string,"p_max_point": number,"p_name": string,"p_rules": Json }; Returns: Json
                           },
"set_batch_publication":
{ Args: { "p_batch_id": string,"p_publish": boolean }; Returns: Json
                           },
"set_results_publication":
{ Args: { "p_ids": (string)[],"p_publish": boolean }; Returns: Json
                           },
"submit_results":
{ Args: { "p_exam_id": string }; Returns: Json
                           },
"valid_grade_rules":
{ Args: { "max_point": number,"rules": Json }; Returns: boolean
                           }
          }
          Enums: {
            "app_role": "super_admin"|"central_admin"|"central_staff"|"institute_admin"|"institute_staff","batch_status": "validated"|"committed"|"published"|"unpublished"|"rolled_back"|"failed","institute_status": "pending"|"approved"|"rejected"|"suspended","result_status": "draft"|"submitted"|"published"|"unpublished","student_status": "active"|"completed"|"dropped"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["super_admin", "central_admin", "central_staff", "institute_admin", "institute_staff"],"batch_status": ["validated", "committed", "published", "unpublished", "rolled_back", "failed"],"institute_status": ["pending", "approved", "rejected", "suspended"],"result_status": ["draft", "submitted", "published", "unpublished"],"student_status": ["active", "completed", "dropped"]
          }
        }
} as const
