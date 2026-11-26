
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "booking_assignments": {
                  Row: {
                    "assigned_at": string,"assigned_by": string | null,"booking_id": string,"drone_id": string,"ended_at": string | null,"id": string,"is_current": boolean,"pilot_user_id": string,"tenant_id": string,"work_period": unknown
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"booking_id": string,"drone_id": string,"ended_at"?: string | null,"id"?: string,"is_current"?: boolean,"pilot_user_id": string,"tenant_id": string,"work_period": unknown
                  }
                  Update: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"booking_id"?: string,"drone_id"?: string,"ended_at"?: string | null,"id"?: string,"is_current"?: boolean,"pilot_user_id"?: string,"tenant_id"?: string,"work_period"?: unknown
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_assignments_booking_same_tenant"
      columns: ["tenant_id","booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "booking_assignments_drone_same_tenant"
      columns: ["tenant_id","drone_id"]
isOneToOne: false
      referencedRelation: "drones"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "booking_assignments_pilot_same_tenant"
      columns: ["tenant_id","pilot_user_id"]
isOneToOne: false
      referencedRelation: "pilot_profiles"
      referencedColumns: ["tenant_id","user_id"]
    }
                  ]
                },"booking_fields": {
                  Row: {
                    "actual_acres": number | null,"area_acres": number,"booking_id": string,"crop_code": string,"crop_name_en": string,"crop_name_hi": string,"farmer_id": string,"field_id": string,"field_name": string,"latitude": number,"longitude": number,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_acres"?: number | null,"area_acres": number,"booking_id": string,"crop_code": string,"crop_name_en": string,"crop_name_hi": string,"farmer_id": string,"field_id": string,"field_name": string,"latitude": number,"longitude": number,"tenant_id": string
                  }
                  Update: {
                    "actual_acres"?: number | null,"area_acres"?: number,"booking_id"?: string,"crop_code"?: string,"crop_name_en"?: string,"crop_name_hi"?: string,"farmer_id"?: string,"field_id"?: string,"field_name"?: string,"latitude"?: number,"longitude"?: number,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_fields_booking_same_farmer"
      columns: ["tenant_id","booking_id","farmer_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["tenant_id","id","farmer_id"]
    },{
      foreignKeyName: "booking_fields_field_same_farmer"
      columns: ["tenant_id","farmer_id","field_id"]
isOneToOne: false
      referencedRelation: "fields"
      referencedColumns: ["tenant_id","farmer_id","id"]
    }
                  ]
                },"booking_status_history": {
                  Row: {
                    "actor_id": string | null,"booking_id": string,"created_at": string,"from_status": Database["public"]['Enums']["booking_status"] | null,"id": number,"reason": string | null,"tenant_id": string,"to_status": Database["public"]['Enums']["booking_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"booking_id": string,"created_at"?: string,"from_status"?: Database["public"]['Enums']["booking_status"] | null,"id"?: never,"reason"?: string | null,"tenant_id": string,"to_status": Database["public"]['Enums']["booking_status"]
                  }
                  Update: {
                    "actor_id"?: string | null,"booking_id"?: string,"created_at"?: string,"from_status"?: Database["public"]['Enums']["booking_status"] | null,"id"?: never,"reason"?: string | null,"tenant_id"?: string,"to_status"?: Database["public"]['Enums']["booking_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_status_history_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_status_history_booking_same_tenant"
      columns: ["tenant_id","booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "actual_total_acres": number | null,"amount_due": number | null,"completed_at": string | null,"completion_notes": string | null,"created_at": string,"farmer_id": string,"id": string,"notes": string | null,"paid_at": string | null,"paid_recorded_by": string | null,"preferred_date": string,"rate_per_acre": number | null,"region_id": string,"requested_by": string | null,"slot_id": string | null,"started_at": string | null,"status": Database["public"]['Enums']["booking_status"],"tenant_id": string,"total_acres": number,"updated_at": string,"verified_at": string | null,"verified_by": string | null,"village_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_total_acres"?: number | null,"amount_due"?: number | null,"completed_at"?: string | null,"completion_notes"?: string | null,"created_at"?: string,"farmer_id": string,"id": string,"notes"?: string | null,"paid_at"?: string | null,"paid_recorded_by"?: string | null,"preferred_date": string,"rate_per_acre"?: number | null,"region_id": string,"requested_by"?: string | null,"slot_id"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["booking_status"],"tenant_id": string,"total_acres": number,"updated_at"?: string,"verified_at"?: string | null,"verified_by"?: string | null,"village_id"?: string | null
                  }
                  Update: {
                    "actual_total_acres"?: number | null,"amount_due"?: number | null,"completed_at"?: string | null,"completion_notes"?: string | null,"created_at"?: string,"farmer_id"?: string,"id"?: string,"notes"?: string | null,"paid_at"?: string | null,"paid_recorded_by"?: string | null,"preferred_date"?: string,"rate_per_acre"?: number | null,"region_id"?: string,"requested_by"?: string | null,"slot_id"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["booking_status"],"tenant_id"?: string,"total_acres"?: number,"updated_at"?: string,"verified_at"?: string | null,"verified_by"?: string | null,"village_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_farmer_same_tenant"
      columns: ["tenant_id","farmer_id"]
isOneToOne: false
      referencedRelation: "farmers"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "bookings_paid_recorded_by_fkey"
      columns: ["paid_recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_region_same_tenant"
      columns: ["tenant_id","region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "bookings_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_slot_same_tenant"
      columns: ["tenant_id","slot_id"]
isOneToOne: false
      referencedRelation: "spray_slots"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "bookings_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_village_same_tenant"
      columns: ["tenant_id","village_id"]
isOneToOne: false
      referencedRelation: "villages"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"drones": {
                  Row: {
                    "created_at": string,"home_region_id": string | null,"id": string,"model": string,"status": Database["public"]['Enums']["drone_status"],"tenant_id": string,"uid": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"home_region_id"?: string | null,"id"?: string,"model": string,"status"?: Database["public"]['Enums']["drone_status"],"tenant_id": string,"uid": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"home_region_id"?: string | null,"id"?: string,"model"?: string,"status"?: Database["public"]['Enums']["drone_status"],"tenant_id"?: string,"uid"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "drones_home_region_same_tenant"
      columns: ["tenant_id","home_region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "drones_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"farmers": {
                  Row: {
                    "address_line": string | null,"consent_recorded_at": string,"created_at": string,"full_name": string,"id": string,"is_active": boolean,"locality": string | null,"phone": string,"pincode": string | null,"profile_id": string | null,"region_id": string | null,"registered_by": string | null,"subdistrict_code": number | null,"tenant_id": string,"updated_at": string,"village_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line"?: string | null,"consent_recorded_at": string,"created_at"?: string,"full_name": string,"id"?: string,"is_active"?: boolean,"locality"?: string | null,"phone": string,"pincode"?: string | null,"profile_id"?: string | null,"region_id"?: string | null,"registered_by"?: string | null,"subdistrict_code"?: number | null,"tenant_id": string,"updated_at"?: string,"village_id"?: string | null
                  }
                  Update: {
                    "address_line"?: string | null,"consent_recorded_at"?: string,"created_at"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"locality"?: string | null,"phone"?: string,"pincode"?: string | null,"profile_id"?: string | null,"region_id"?: string | null,"registered_by"?: string | null,"subdistrict_code"?: number | null,"tenant_id"?: string,"updated_at"?: string,"village_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "farmers_profile_member_same_tenant"
      columns: ["tenant_id","profile_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","user_id"]
    },{
      foreignKeyName: "farmers_region_same_tenant"
      columns: ["tenant_id","region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "farmers_registered_by_fkey"
      columns: ["registered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "farmers_subdistrict_code_fkey"
      columns: ["subdistrict_code"]
isOneToOne: false
      referencedRelation: "geo_subdistricts"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "farmers_village_same_tenant"
      columns: ["tenant_id","village_id"]
isOneToOne: false
      referencedRelation: "villages"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"fields": {
                  Row: {
                    "area_acres": number,"boundary": unknown,"created_at": string,"crop_id": string,"farmer_id": string,"id": string,"is_active": boolean,"latitude": number,"location": unknown,"longitude": number,"name": string,"tenant_id": string,"updated_at": string,"boundary_geojson": Json | null
                  }
                  ComputedFields: "boundary_geojson"
                  Insert: {
                    "area_acres": number,"boundary"?: unknown,"created_at"?: string,"crop_id": string,"farmer_id": string,"id"?: string,"is_active"?: boolean,"latitude": number,"location"?: never,"longitude": number,"name": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "area_acres"?: number,"boundary"?: unknown,"created_at"?: string,"crop_id"?: string,"farmer_id"?: string,"id"?: string,"is_active"?: boolean,"latitude"?: number,"location"?: never,"longitude"?: number,"name"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fields_crop_same_tenant"
      columns: ["tenant_id","crop_id"]
isOneToOne: false
      referencedRelation: "tenant_crops"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "fields_farmer_same_tenant"
      columns: ["tenant_id","farmer_id"]
isOneToOne: false
      referencedRelation: "farmers"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"geo_districts": {
                  Row: {
                    "code": number,"name": string,"state_code": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": number,"name": string,"state_code": number
                  }
                  Update: {
                    "code"?: number,"name"?: string,"state_code"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "geo_districts_state_code_fkey"
      columns: ["state_code"]
isOneToOne: false
      referencedRelation: "geo_states"
      referencedColumns: ["code"]
    }
                  ]
                },"geo_states": {
                  Row: {
                    "code": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": number,"name": string
                  }
                  Update: {
                    "code"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"geo_subdistricts": {
                  Row: {
                    "code": number,"district_code": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": number,"district_code": number,"name": string
                  }
                  Update: {
                    "code"?: number,"district_code"?: number,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "geo_subdistricts_district_code_fkey"
      columns: ["district_code"]
isOneToOne: false
      referencedRelation: "geo_districts"
      referencedColumns: ["code"]
    }
                  ]
                },"mitra_invites": {
                  Row: {
                    "created_at": string,"email": string,"failure_reason": string | null,"id": string,"inviter_id": string | null,"status": Database["public"]['Enums']["pilot_invite_status"],"tenant_id": string,"updated_at": string,"user_id": string | null,"village_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"failure_reason"?: string | null,"id"?: string,"inviter_id"?: string | null,"status": Database["public"]['Enums']["pilot_invite_status"],"tenant_id": string,"updated_at"?: string,"user_id"?: string | null,"village_id": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"failure_reason"?: string | null,"id"?: string,"inviter_id"?: string | null,"status"?: Database["public"]['Enums']["pilot_invite_status"],"tenant_id"?: string,"updated_at"?: string,"user_id"?: string | null,"village_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mitra_invites_inviter_id_fkey"
      columns: ["inviter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mitra_invites_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mitra_invites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mitra_invites_village_same_tenant"
      columns: ["tenant_id","village_id"]
isOneToOne: false
      referencedRelation: "villages"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"mitra_villages": {
                  Row: {
                    "created_at": string,"tenant_id": string,"user_id": string,"village_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"tenant_id": string,"user_id": string,"village_id": string
                  }
                  Update: {
                    "created_at"?: string,"tenant_id"?: string,"user_id"?: string,"village_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mitra_villages_member_same_tenant"
      columns: ["tenant_id","user_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","user_id"]
    },{
      foreignKeyName: "mitra_villages_village_same_tenant"
      columns: ["tenant_id","village_id"]
isOneToOne: false
      referencedRelation: "villages"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"organization_domains": {
                  Row: {
                    "created_at": string,"hostname": string,"is_primary": boolean,"is_verified": boolean,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"hostname": string,"is_primary"?: boolean,"is_verified"?: boolean,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"hostname"?: string,"is_primary"?: boolean,"is_verified"?: boolean,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_domains_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_features": {
                  Row: {
                    "created_at": string,"enabled": boolean,"feature_key": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"enabled"?: boolean,"feature_key": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"enabled"?: boolean,"feature_key"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_features_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_members": {
                  Row: {
                    "created_at": string,"organization_id": string,"role": Database["public"]['Enums']["organization_role"],"tenant_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"organization_id": string,"role": Database["public"]['Enums']["organization_role"],"tenant_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"organization_id"?: string,"role"?: Database["public"]['Enums']["organization_role"],"tenant_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_members_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organization_members_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organization_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_settings": {
                  Row: {
                    "brand_accent_color": string | null,"brand_logo_path": string | null,"brand_name": string | null,"brand_primary_color": string | null,"brand_tagline": string | null,"created_at": string,"default_locale": string,"tenant_id": string,"timezone": string,"updated_at": string,"upi_id": string | null,"upi_payee_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_accent_color"?: string | null,"brand_logo_path"?: string | null,"brand_name"?: string | null,"brand_primary_color"?: string | null,"brand_tagline"?: string | null,"created_at"?: string,"default_locale"?: string,"tenant_id": string,"timezone"?: string,"updated_at"?: string,"upi_id"?: string | null,"upi_payee_name"?: string | null
                  }
                  Update: {
                    "brand_accent_color"?: string | null,"brand_logo_path"?: string | null,"brand_name"?: string | null,"brand_primary_color"?: string | null,"brand_tagline"?: string | null,"created_at"?: string,"default_locale"?: string,"tenant_id"?: string,"timezone"?: string,"updated_at"?: string,"upi_id"?: string | null,"upi_payee_name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_settings_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"name": string,"organization_type": Database["public"]['Enums']["organization_type"],"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"organization_type"?: Database["public"]['Enums']["organization_type"],"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"organization_type"?: Database["public"]['Enums']["organization_type"],"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organizations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pilot_invites": {
                  Row: {
                    "created_at": string,"email": string,"failure_reason": string | null,"home_region_id": string,"id": string,"inviter_id": string | null,"status": Database["public"]['Enums']["pilot_invite_status"],"tenant_id": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"failure_reason"?: string | null,"home_region_id": string,"id"?: string,"inviter_id"?: string | null,"status": Database["public"]['Enums']["pilot_invite_status"],"tenant_id": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"failure_reason"?: string | null,"home_region_id"?: string,"id"?: string,"inviter_id"?: string | null,"status"?: Database["public"]['Enums']["pilot_invite_status"],"tenant_id"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pilot_invites_inviter_id_fkey"
      columns: ["inviter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pilot_invites_region_same_tenant"
      columns: ["tenant_id","home_region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "pilot_invites_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pilot_invites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pilot_profiles": {
                  Row: {
                    "created_at": string,"created_by": string | null,"home_region_id": string | null,"is_active": boolean,"license_number": string | null,"tenant_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"home_region_id"?: string | null,"is_active"?: boolean,"license_number"?: string | null,"tenant_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"home_region_id"?: string | null,"is_active"?: boolean,"license_number"?: string | null,"tenant_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pilot_profiles_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pilot_profiles_home_region_same_tenant"
      columns: ["tenant_id","home_region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "pilot_profiles_member_same_tenant"
      columns: ["tenant_id","user_id"]
isOneToOne: true
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","user_id"]
    }
                  ]
                },"platform_audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_platform_role": Database["public"]['Enums']["platform_role"] | null,"details": NonNullable<Json>,"id": number,"occurred_at": string,"target_id": string | null,"target_table": string | null,"target_tenant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_platform_role"?: Database["public"]['Enums']["platform_role"] | null,"details"?: NonNullable<Json>,"id"?: never,"occurred_at"?: string,"target_id"?: string | null,"target_table"?: string | null,"target_tenant_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_platform_role"?: Database["public"]['Enums']["platform_role"] | null,"details"?: NonNullable<Json>,"id"?: never,"occurred_at"?: string,"target_id"?: string | null,"target_table"?: string | null,"target_tenant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_staff": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"role": Database["public"]['Enums']["platform_role"],"status": Database["public"]['Enums']["platform_staff_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"role": Database["public"]['Enums']["platform_role"],"status"?: Database["public"]['Enums']["platform_staff_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"role"?: Database["public"]['Enums']["platform_role"],"status"?: Database["public"]['Enums']["platform_staff_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_staff_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "platform_staff_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string | null,"id": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"id": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"id"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"region_districts": {
                  Row: {
                    "created_at": string,"district_code": number,"region_id": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"district_code": number,"region_id": string,"tenant_id": string
                  }
                  Update: {
                    "created_at"?: string,"district_code"?: number,"region_id"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "region_districts_district_code_fkey"
      columns: ["district_code"]
isOneToOne: false
      referencedRelation: "geo_districts"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "region_districts_region_same_tenant"
      columns: ["tenant_id","region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"region_subdistricts": {
                  Row: {
                    "created_at": string,"region_id": string,"subdistrict_code": number,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"region_id": string,"subdistrict_code": number,"tenant_id": string
                  }
                  Update: {
                    "created_at"?: string,"region_id"?: string,"subdistrict_code"?: number,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "region_subdistricts_region_same_tenant"
      columns: ["tenant_id","region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "region_subdistricts_subdistrict_code_fkey"
      columns: ["subdistrict_code"]
isOneToOne: false
      referencedRelation: "geo_subdistricts"
      referencedColumns: ["code"]
    }
                  ]
                },"regional_admin_invites": {
                  Row: {
                    "created_at": string,"email": string,"failure_reason": string | null,"id": string,"inviter_id": string | null,"region_id": string,"status": Database["public"]['Enums']["pilot_invite_status"],"tenant_id": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"failure_reason"?: string | null,"id"?: string,"inviter_id"?: string | null,"region_id": string,"status": Database["public"]['Enums']["pilot_invite_status"],"tenant_id": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"failure_reason"?: string | null,"id"?: string,"inviter_id"?: string | null,"region_id"?: string,"status"?: Database["public"]['Enums']["pilot_invite_status"],"tenant_id"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "regional_admin_invites_inviter_id_fkey"
      columns: ["inviter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "regional_admin_invites_region_same_tenant"
      columns: ["tenant_id","region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["tenant_id","id"]
    },{
      foreignKeyName: "regional_admin_invites_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "regional_admin_invites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"regional_admin_regions": {
                  Row: {
                    "created_at": string,"region_id": string,"tenant_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"region_id": string,"tenant_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"region_id"?: string,"tenant_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "regional_admin_regions_member_same_tenant"
      columns: ["tenant_id","user_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","user_id"]
    },{
      foreignKeyName: "regional_admin_regions_region_same_tenant"
      columns: ["tenant_id","region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                },"regions": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"rate_per_acre": number | null,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"rate_per_acre"?: number | null,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"rate_per_acre"?: number | null,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "regions_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"spray_slots": {
                  Row: {
                    "created_at": string,"end_time": string,"id": string,"is_active": boolean,"name_en": string,"name_hi": string,"sort_order": number,"start_time": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_time": string,"id"?: string,"is_active"?: boolean,"name_en": string,"name_hi": string,"sort_order"?: number,"start_time": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"end_time"?: string,"id"?: string,"is_active"?: boolean,"name_en"?: string,"name_hi"?: string,"sort_order"?: number,"start_time"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "spray_slots_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_crops": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"is_active": boolean,"name_en": string,"name_hi": string,"sort_order": number,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name_en": string,"name_hi": string,"sort_order"?: number,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name_en"?: string,"name_hi"?: string,"sort_order"?: number,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_crops_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"villages": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"latitude": number | null,"lgd_code": string | null,"location": unknown,"longitude": number | null,"name": string,"region_id": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"latitude"?: number | null,"lgd_code"?: string | null,"location"?: never,"longitude"?: number | null,"name": string,"region_id": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"latitude"?: number | null,"lgd_code"?: string | null,"location"?: never,"longitude"?: number | null,"name"?: string,"region_id"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "villages_region_same_tenant"
      columns: ["tenant_id","region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["tenant_id","id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_organization_member":
{ Args: { "p_organization_id": string,"p_role": Database["public"]['Enums']["organization_role"],"p_user_id": string }; Returns: undefined
                           },
"assign_booking":
{ Args: { "p_booking_id": string,"p_drone_id": string,"p_pilot_user_id": string }; Returns: undefined
                           },
"booking_work_period":
{ Args: { "p_date": string,"p_end": string,"p_start": string,"p_tenant_id": string }; Returns: unknown
                           },
"bootstrap_platform_owner":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"boundary_geojson":
{ Args: { "p_field": Omit<Database["public"]['Tables']["fields"]['Row'], Database["public"]['Tables']["fields"]['ComputedFields']> }; Returns: Json
                           },
"can_book_for_farmer":
{ Args: { "p_farmer_id": string }; Returns: boolean
                           },
"can_invite_mitra":
{ Args: { "p_village_id": string }; Returns: boolean
                           },
"can_invite_pilot":
{ Args: { "p_home_region_id": string }; Returns: boolean
                           },
"can_invite_regional_admin":
{ Args: { "p_region_id": string }; Returns: boolean
                           },
"can_manage_farmer":
{ Args: { "p_farmer_id": string }; Returns: boolean
                           },
"can_manage_farmer_location":
{ Args: { "p_region_id": string,"p_tenant_id": string,"p_village_id": string }; Returns: boolean
                           },
"can_manage_farmers_in_village":
{ Args: { "p_village_id": string }; Returns: boolean
                           },
"can_manage_fleet_item":
{ Args: { "p_home_region_id": string,"p_tenant_id": string }; Returns: boolean
                           },
"can_manage_region":
{ Args: { "p_region_id": string }; Returns: boolean
                           },
"can_manage_village":
{ Args: { "p_village_id": string }; Returns: boolean
                           },
"can_view_booking":
{ Args: { "p_booking_id": string }; Returns: boolean
                           },
"can_view_farmer":
{ Args: { "p_farmer_id": string }; Returns: boolean
                           },
"can_view_fleet":
{ Args: { "p_tenant_id": string }; Returns: boolean
                           },
"claim_mitra_invite":
{ Args: { "p_email": string,"p_inviter_id": string,"p_village_id": string }; Returns: {
              "invite_id": string,"outcome": Database["public"]['Enums']["pilot_invite_status"]
            }[]
                           },
"claim_pilot_invite":
{ Args: { "p_email": string,"p_home_region_id": string,"p_inviter_id": string }; Returns: {
              "invite_id": string,"outcome": Database["public"]['Enums']["pilot_invite_status"]
            }[]
                           },
"claim_regional_admin_invite":
{ Args: { "p_email": string,"p_inviter_id": string,"p_region_id": string }; Returns: {
              "invite_id": string,"outcome": Database["public"]['Enums']["pilot_invite_status"]
            }[]
                           },
"complete_job":
{ Args: { "p_acres": (number)[],"p_booking_id": string,"p_field_ids": (string)[],"p_notes"?: string }; Returns: undefined
                           },
"create_booking":
{ Args: { "p_booking_id": string,"p_farmer_id": string,"p_field_ids": (string)[],"p_notes"?: string,"p_preferred_date": string,"p_slot_id": string }; Returns: string
                           },
"delete_orphaned_pilot_invite":
{ Args: { "p_not_before": string,"p_user_id": string }; Returns: boolean
                           },
"expire_stale_staff_invites":
{ Args: { "p_email": string }; Returns: undefined
                           },
"fail_mitra_invite":
{ Args: { "p_invite_id": string,"p_reason": string }; Returns: undefined
                           },
"fail_pilot_invite":
{ Args: { "p_invite_id": string,"p_reason": string }; Returns: undefined
                           },
"fail_regional_admin_invite":
{ Args: { "p_invite_id": string,"p_reason": string }; Returns: undefined
                           },
"farmer_address_label":
{ Args: { "p_farmer_id": string }; Returns: string
                           },
"farmer_registration_open":
{ Args: { "p_hostname": string }; Returns: boolean
                           },
"farmer_registration_tenant":
{ Args: { "p_hostname": string }; Returns: string
                           },
"farmer_service_region":
{ Args: { "p_farmer_id": string }; Returns: string
                           },
"get_booking_payment":
{ Args: { "p_booking_id": string }; Returns: {
              "amount_due": number,"paid_at": string,"payee_name": string,"rate_per_acre": number,"upi_id": string
            }[]
                           },
"get_farmer_registration_villages":
{ Args: { "p_hostname": string }; Returns: {
              "region_name": string,"village_id": string,"village_name": string
            }[]
                           },
"get_profile_phone":
{ Args: { "p_profile_id": string }; Returns: string
                           },
"get_public_branding":
{ Args: { "p_hostname": string }; Returns: {
              "brand_accent_color": string,"brand_logo_path": string,"brand_name": string,"brand_primary_color": string,"brand_tagline": string,"default_locale": string
            }[]
                           },
"has_organization_role":
{ Args: { "p_organization_id": string,"p_roles": (Database["public"]['Enums']["organization_role"])[] }; Returns: boolean
                           },
"is_assigned_pilot":
{ Args: { "p_booking_id": string }; Returns: boolean
                           },
"is_mitra_for_village":
{ Args: { "p_village_id": string }; Returns: boolean
                           },
"is_organization_member":
{ Args: { "p_organization_id": string }; Returns: boolean
                           },
"is_own_farmer":
{ Args: { "p_farmer_id": string }; Returns: boolean
                           },
"is_platform_owner":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_platform_role":
{ Args: { "p_roles": (Database["public"]['Enums']["platform_role"])[] }; Returns: boolean
                           },
"is_platform_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_system_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"list_assignment_options":
{ Args: { "p_booking_id": string }; Returns: {
              "id": string,"is_current": boolean,"is_home_region": boolean,"kind": string,"label": string,"region_name": string
            }[]
                           },
"list_my_jobs":
{ Args: { "p_tenant_id": string }; Returns: {
              "actual_total_acres": number,"amount_due": number,"booking_id": string,"drone_uid": string,"end_time": string,"farmer_name": string,"farmer_phone": string,"fields": Json,"notes": string,"paid_at": string,"preferred_date": string,"sent_back_reason": string,"slot_name_en": string,"slot_name_hi": string,"start_time": string,"status": Database["public"]['Enums']["booking_status"],"total_acres": number,"village_name": string
            }[]
                           },
"list_slot_availability":
{ Args: { "p_date": string,"p_farmer_id": string }; Returns: {
              "available": number,"end_time": string,"name_en": string,"name_hi": string,"slot_id": string,"start_time": string
            }[]
                           },
"log_platform_tenant_access":
{ Args: { "p_context": string,"p_tenant_id": string }; Returns: undefined
                           },
"manage_platform_staff":
{ Args: { "p_role": Database["public"]['Enums']["platform_role"],"p_status"?: Database["public"]['Enums']["platform_staff_status"],"p_user_id": string }; Returns: undefined
                           },
"mitra_inviter_tenant":
{ Args: { "p_inviter_id": string,"p_village_id": string }; Returns: string
                           },
"pilot_inviter_tenant":
{ Args: { "p_home_region_id": string,"p_inviter_id": string }; Returns: string
                           },
"profiles_share_organization":
{ Args: { "p_profile_id": string }; Returns: boolean
                           },
"provision_customer_organization":
{ Args: { "p_brand_name"?: string,"p_brand_primary_color"?: string,"p_enabled_features"?: (string)[],"p_initial_admin_email": string,"p_name": string,"p_organization_type": Database["public"]['Enums']["organization_type"],"p_slug": string }; Returns: string
                           },
"provision_invited_mitra":
{ Args: { "p_invite_id": string,"p_user_id": string }; Returns: string
                           },
"provision_invited_pilot":
{ Args: { "p_invite_id": string,"p_license_number"?: string,"p_user_id": string }; Returns: string
                           },
"provision_invited_regional_admin":
{ Args: { "p_invite_id": string,"p_user_id": string }; Returns: string
                           },
"record_job_payment":
{ Args: { "p_booking_id": string }; Returns: undefined
                           },
"region_for_subdistrict":
{ Args: { "p_subdistrict_code": number,"p_tenant_id": string }; Returns: string
                           },
"regional_admin_inviter_tenant":
{ Args: { "p_inviter_id": string,"p_region_id": string }; Returns: string
                           },
"register_self_as_farmer":
{ Args: { "p_address_line": string,"p_full_name": string,"p_hostname": string,"p_locality": string,"p_phone": string,"p_pincode": string,"p_subdistrict_code": number,"p_village_id"?: string }; Returns: string
                           },
"set_booking_status":
{ Args: { "p_booking_id": string,"p_reason"?: string,"p_to_status": Database["public"]['Enums']["booking_status"] }; Returns: undefined
                           },
"slot_remaining_capacity":
{ Args: { "p_date": string,"p_region_id": string,"p_slot_id": string }; Returns: number
                           },
"staff_invite_attempts_last_hour":
{ Args: { "p_inviter_id": string }; Returns: number
                           },
"staff_invite_email_taken":
{ Args: { "p_email": string }; Returns: boolean
                           },
"start_job":
{ Args: { "p_booking_id": string }; Returns: undefined
                           },
"tenant_local_now":
{ Args: { "p_tenant_id": string }; Returns: string
                           },
"write_platform_audit":
{ Args: { "p_action": string,"p_details": Json,"p_target_id": string,"p_target_table": string,"p_target_tenant_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "booking_status": "requested"|"confirmed"|"rejected"|"cancelled"|"assigned"|"in_progress"|"completed"|"verified","drone_status": "active"|"maintenance"|"retired","organization_role": "super_admin"|"admin"|"mitra"|"farmer"|"pilot"|"organization_admin"|"regional_admin","organization_type": "customer"|"agriasaan","pilot_invite_status": "claimed"|"provisioned"|"email_in_use"|"rate_limited"|"failed"|"expired","platform_role": "platform_owner"|"system_admin"|"developer"|"support","platform_staff_status": "active"|"suspended"
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
  "public": {
          Enums: {
            "booking_status": ["requested", "confirmed", "rejected", "cancelled", "assigned", "in_progress", "completed", "verified"],"drone_status": ["active", "maintenance", "retired"],"organization_role": ["super_admin", "admin", "mitra", "farmer", "pilot", "organization_admin", "regional_admin"],"organization_type": ["customer", "agriasaan"],"pilot_invite_status": ["claimed", "provisioned", "email_in_use", "rate_limited", "failed", "expired"],"platform_role": ["platform_owner", "system_admin", "developer", "support"],"platform_staff_status": ["active", "suspended"]
          }
        }
} as const
