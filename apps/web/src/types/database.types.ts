
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "mitra_villages": {
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
                    "brand_accent_color": string | null,"brand_logo_path": string | null,"brand_name": string | null,"brand_primary_color": string | null,"brand_tagline": string | null,"created_at": string,"default_locale": string,"tenant_id": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_accent_color"?: string | null,"brand_logo_path"?: string | null,"brand_name"?: string | null,"brand_primary_color"?: string | null,"brand_tagline"?: string | null,"created_at"?: string,"default_locale"?: string,"tenant_id": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "brand_accent_color"?: string | null,"brand_logo_path"?: string | null,"brand_name"?: string | null,"brand_primary_color"?: string | null,"brand_tagline"?: string | null,"created_at"?: string,"default_locale"?: string,"tenant_id"?: string,"timezone"?: string,"updated_at"?: string
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
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"tenant_id"?: string,"updated_at"?: string
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
"bootstrap_platform_owner":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"can_manage_region":
{ Args: { "p_region_id": string }; Returns: boolean
                           },
"can_manage_village":
{ Args: { "p_village_id": string }; Returns: boolean
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
"is_mitra_for_village":
{ Args: { "p_village_id": string }; Returns: boolean
                           },
"is_organization_member":
{ Args: { "p_organization_id": string }; Returns: boolean
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
"log_platform_tenant_access":
{ Args: { "p_context": string,"p_tenant_id": string }; Returns: undefined
                           },
"manage_platform_staff":
{ Args: { "p_role": Database["public"]['Enums']["platform_role"],"p_status"?: Database["public"]['Enums']["platform_staff_status"],"p_user_id": string }; Returns: undefined
                           },
"profiles_share_organization":
{ Args: { "p_profile_id": string }; Returns: boolean
                           },
"provision_customer_organization":
{ Args: { "p_brand_name"?: string,"p_brand_primary_color"?: string,"p_enabled_features"?: (string)[],"p_initial_admin_email": string,"p_name": string,"p_organization_type": Database["public"]['Enums']["organization_type"],"p_slug": string }; Returns: string
                           },
"write_platform_audit":
{ Args: { "p_action": string,"p_details": Json,"p_target_id": string,"p_target_table": string,"p_target_tenant_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "organization_role": "super_admin"|"admin"|"mitra"|"farmer"|"pilot"|"organization_admin"|"regional_admin","organization_type": "customer"|"agriasaan","platform_role": "platform_owner"|"system_admin"|"developer"|"support","platform_staff_status": "active"|"suspended"
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
            "organization_role": ["super_admin", "admin", "mitra", "farmer", "pilot", "organization_admin", "regional_admin"],"organization_type": ["customer", "agriasaan"],"platform_role": ["platform_owner", "system_admin", "developer", "support"],"platform_staff_status": ["active", "suspended"]
          }
        }
} as const
