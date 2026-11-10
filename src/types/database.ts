
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
            "audit_logs": {
                  Row: {
                    "action": string,"actor": string | null,"created_at": string,"household_id": string | null,"id": number,"new_data": Json | null,"old_data": Json | null,"owner_user_id": string | null,"reason": string | null,"record_id": string | null,"scope": Database["public"]['Enums']["data_scope"],"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor"?: string | null,"created_at"?: string,"household_id"?: string | null,"id"?: number,"new_data"?: Json | null,"old_data"?: Json | null,"owner_user_id"?: string | null,"reason"?: string | null,"record_id"?: string | null,"scope"?: Database["public"]['Enums']["data_scope"],"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"created_at"?: string,"household_id"?: string | null,"id"?: number,"new_data"?: Json | null,"old_data"?: Json | null,"owner_user_id"?: string | null,"reason"?: string | null,"record_id"?: string | null,"scope"?: Database["public"]['Enums']["data_scope"],"table_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"bill_cycles": {
                  Row: {
                    "bill_id": string,"cancelled_at": string | null,"created_at": string,"due_date": string,"expected_amount": number,"household_id": string,"id": string,"note": string | null,"original_due_date": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bill_id": string,"cancelled_at"?: string | null,"created_at"?: string,"due_date": string,"expected_amount": number,"household_id": string,"id"?: string,"note"?: string | null,"original_due_date": string,"updated_at"?: string
                  }
                  Update: {
                    "bill_id"?: string,"cancelled_at"?: string | null,"created_at"?: string,"due_date"?: string,"expected_amount"?: number,"household_id"?: string,"id"?: string,"note"?: string | null,"original_due_date"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bill_cycles_bill_id_fkey"
      columns: ["bill_id"]
isOneToOne: false
      referencedRelation: "bills"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bill_cycles_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"bills": {
                  Row: {
                    "active": boolean,"amount_type": string,"category_id": string,"created_at": string,"created_by": string | null,"due_day": number,"estimated_amount": number,"frequency": string,"household_id": string,"id": string,"kind": string,"name": string,"owner_user_id": string | null,"provider": string | null,"reminder_offsets": (number)[],"responsible_member_id": string | null,"scope": Database["public"]['Enums']["data_scope"],"shares": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"amount_type"?: string,"category_id": string,"created_at"?: string,"created_by"?: string | null,"due_day": number,"estimated_amount": number,"frequency"?: string,"household_id": string,"id"?: string,"kind"?: string,"name": string,"owner_user_id"?: string | null,"provider"?: string | null,"reminder_offsets"?: (number)[],"responsible_member_id"?: string | null,"scope"?: Database["public"]['Enums']["data_scope"],"shares"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"amount_type"?: string,"category_id"?: string,"created_at"?: string,"created_by"?: string | null,"due_day"?: number,"estimated_amount"?: number,"frequency"?: string,"household_id"?: string,"id"?: string,"kind"?: string,"name"?: string,"owner_user_id"?: string | null,"provider"?: string | null,"reminder_offsets"?: (number)[],"responsible_member_id"?: string | null,"scope"?: Database["public"]['Enums']["data_scope"],"shares"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bills_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bills_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bills_responsible_member_id_fkey"
      columns: ["responsible_member_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id"]
    }
                  ]
                },"budget_allocations": {
                  Row: {
                    "amount": number,"category_id": string,"created_at": string,"created_by": string | null,"household_id": string,"id": string,"is_recurring": boolean,"note": string | null,"period_id": string,"shares": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category_id": string,"created_at"?: string,"created_by"?: string | null,"household_id": string,"id"?: string,"is_recurring"?: boolean,"note"?: string | null,"period_id": string,"shares"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"category_id"?: string,"created_at"?: string,"created_by"?: string | null,"household_id"?: string,"id"?: string,"is_recurring"?: boolean,"note"?: string | null,"period_id"?: string,"shares"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "budget_allocations_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "budget_allocations_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "budget_allocations_period_id_fkey"
      columns: ["period_id"]
isOneToOne: false
      referencedRelation: "budget_periods"
      referencedColumns: ["id"]
    }
                  ]
                },"budget_moves": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"from_allocation_id": string | null,"fund_id": string | null,"household_id": string,"id": string,"kind": string,"reason": string,"savings_goal_id": string | null,"to_allocation_id": string | null,"transaction_id": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"from_allocation_id"?: string | null,"fund_id"?: string | null,"household_id": string,"id"?: string,"kind": string,"reason": string,"savings_goal_id"?: string | null,"to_allocation_id"?: string | null,"transaction_id"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"from_allocation_id"?: string | null,"fund_id"?: string | null,"household_id"?: string,"id"?: string,"kind"?: string,"reason"?: string,"savings_goal_id"?: string | null,"to_allocation_id"?: string | null,"transaction_id"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "budget_moves_from_allocation_id_fkey"
      columns: ["from_allocation_id"]
isOneToOne: false
      referencedRelation: "budget_allocations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "budget_moves_from_allocation_id_fkey"
      columns: ["from_allocation_id"]
isOneToOne: false
      referencedRelation: "v_allocations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "budget_moves_fund_id_fkey"
      columns: ["fund_id"]
isOneToOne: false
      referencedRelation: "funds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "budget_moves_fund_id_fkey"
      columns: ["fund_id"]
isOneToOne: false
      referencedRelation: "v_fund_balances"
      referencedColumns: ["fund_id"]
    },{
      foreignKeyName: "budget_moves_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "budget_moves_savings_goal_id_fkey"
      columns: ["savings_goal_id"]
isOneToOne: false
      referencedRelation: "savings_goals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "budget_moves_savings_goal_id_fkey"
      columns: ["savings_goal_id"]
isOneToOne: false
      referencedRelation: "v_goal_balances"
      referencedColumns: ["goal_id"]
    },{
      foreignKeyName: "budget_moves_to_allocation_id_fkey"
      columns: ["to_allocation_id"]
isOneToOne: false
      referencedRelation: "budget_allocations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "budget_moves_to_allocation_id_fkey"
      columns: ["to_allocation_id"]
isOneToOne: false
      referencedRelation: "v_allocations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "budget_moves_transaction_id_fkey"
      columns: ["transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id"]
    }
                  ]
                },"budget_periods": {
                  Row: {
                    "created_at": string,"household_id": string,"id": string,"month": number,"notes": string | null,"status": string,"updated_at": string,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id": string,"id"?: string,"month": number,"notes"?: string | null,"status"?: string,"updated_at"?: string,"year": number
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"id"?: string,"month"?: number,"notes"?: string | null,"status"?: string,"updated_at"?: string,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "budget_periods_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "archived_at": string | null,"color": string,"created_at": string,"created_by": string | null,"household_id": string,"icon": string,"id": string,"is_extraordinary": boolean,"is_variable": boolean,"kind": string,"linked_fund_id": string | null,"name": string,"owner_user_id": string | null,"parent_id": string | null,"scope": Database["public"]['Enums']["data_scope"],"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"created_by"?: string | null,"household_id": string,"icon"?: string,"id"?: string,"is_extraordinary"?: boolean,"is_variable"?: boolean,"kind"?: string,"linked_fund_id"?: string | null,"name": string,"owner_user_id"?: string | null,"parent_id"?: string | null,"scope"?: Database["public"]['Enums']["data_scope"],"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"created_by"?: string | null,"household_id"?: string,"icon"?: string,"id"?: string,"is_extraordinary"?: boolean,"is_variable"?: boolean,"kind"?: string,"linked_fund_id"?: string | null,"name"?: string,"owner_user_id"?: string | null,"parent_id"?: string | null,"scope"?: Database["public"]['Enums']["data_scope"],"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "categories_linked_fund_id_fkey"
      columns: ["linked_fund_id"]
isOneToOne: false
      referencedRelation: "funds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "categories_linked_fund_id_fkey"
      columns: ["linked_fund_id"]
isOneToOne: false
      referencedRelation: "v_fund_balances"
      referencedColumns: ["fund_id"]
    },{
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"debts": {
                  Row: {
                    "created_at": string,"created_by": string | null,"creditor": string | null,"due_date": string | null,"frequency": string,"household_id": string,"id": string,"installment_amount": number | null,"installments_count": number | null,"interest_rate": number | null,"kind": string,"name": string,"notes": string | null,"original_amount": number,"owner_user_id": string | null,"responsible_member_id": string | null,"scope": Database["public"]['Enums']["data_scope"],"start_date": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"creditor"?: string | null,"due_date"?: string | null,"frequency"?: string,"household_id": string,"id"?: string,"installment_amount"?: number | null,"installments_count"?: number | null,"interest_rate"?: number | null,"kind"?: string,"name": string,"notes"?: string | null,"original_amount": number,"owner_user_id"?: string | null,"responsible_member_id"?: string | null,"scope"?: Database["public"]['Enums']["data_scope"],"start_date": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"creditor"?: string | null,"due_date"?: string | null,"frequency"?: string,"household_id"?: string,"id"?: string,"installment_amount"?: number | null,"installments_count"?: number | null,"interest_rate"?: number | null,"kind"?: string,"name"?: string,"notes"?: string | null,"original_amount"?: number,"owner_user_id"?: string | null,"responsible_member_id"?: string | null,"scope"?: Database["public"]['Enums']["data_scope"],"start_date"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "debts_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "debts_responsible_member_id_fkey"
      columns: ["responsible_member_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id"]
    }
                  ]
                },"funds": {
                  Row: {
                    "archived_at": string | null,"color": string,"created_at": string,"created_by": string | null,"household_id": string,"icon": string,"id": string,"initial_balance": number,"kind": string,"name": string,"owner_user_id": string | null,"responsible_member_id": string | null,"scope": Database["public"]['Enums']["data_scope"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"created_by"?: string | null,"household_id": string,"icon"?: string,"id"?: string,"initial_balance"?: number,"kind"?: string,"name": string,"owner_user_id"?: string | null,"responsible_member_id"?: string | null,"scope"?: Database["public"]['Enums']["data_scope"],"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"created_by"?: string | null,"household_id"?: string,"icon"?: string,"id"?: string,"initial_balance"?: number,"kind"?: string,"name"?: string,"owner_user_id"?: string | null,"responsible_member_id"?: string | null,"scope"?: Database["public"]['Enums']["data_scope"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "funds_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "funds_responsible_member_id_fkey"
      columns: ["responsible_member_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id"]
    }
                  ]
                },"household_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"code": string,"created_at": string,"created_by": string,"expires_at": string,"household_id": string,"id": string,"member_id": string | null,"revoked_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"code": string,"created_at"?: string,"created_by": string,"expires_at"?: string,"household_id": string,"id"?: string,"member_id"?: string | null,"revoked_at"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string,"expires_at"?: string,"household_id"?: string,"id"?: string,"member_id"?: string | null,"revoked_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_invites_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "household_invites_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id"]
    }
                  ]
                },"household_members": {
                  Row: {
                    "color": string,"created_at": string,"display_name": string,"household_id": string,"id": string,"joined_at": string | null,"role": Database["public"]['Enums']["member_role"],"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"display_name": string,"household_id": string,"id"?: string,"joined_at"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"display_name"?: string,"household_id"?: string,"id"?: string,"joined_at"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "created_at": string,"created_by": string | null,"currency": string,"id": string,"name": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"name": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"name"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"income_records": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"effective_from": string,"household_id": string,"id": string,"member_id": string,"note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"effective_from": string,"household_id": string,"id"?: string,"member_id": string,"note"?: string | null
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"effective_from"?: string,"household_id"?: string,"id"?: string,"member_id"?: string,"note"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "income_records_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "income_records_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"data": NonNullable<Json>,"dedupe_key": string | null,"household_id": string | null,"id": string,"kind": string,"read_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"data"?: NonNullable<Json>,"dedupe_key"?: string | null,"household_id"?: string | null,"id"?: string,"kind": string,"read_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"data"?: NonNullable<Json>,"dedupe_key"?: string | null,"household_id"?: string | null,"id"?: string,"kind"?: string,"read_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_methods": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"household_id": string,"id": string,"kind": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"household_id": string,"id"?: string,"kind"?: string,"name": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"household_id"?: string,"id"?: string,"kind"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_methods_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"push_tokens": {
                  Row: {
                    "platform": string,"token": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "platform": string,"token": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "platform"?: string,"token"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reminders": {
                  Row: {
                    "created_at": string,"created_by": string | null,"done_at": string | null,"household_id": string,"id": string,"note": string | null,"owner_user_id": string | null,"remind_on": string,"scope": Database["public"]['Enums']["data_scope"],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"household_id": string,"id"?: string,"note"?: string | null,"owner_user_id"?: string | null,"remind_on": string,"scope"?: Database["public"]['Enums']["data_scope"],"title": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"household_id"?: string,"id"?: string,"note"?: string | null,"owner_user_id"?: string | null,"remind_on"?: string,"scope"?: Database["public"]['Enums']["data_scope"],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminders_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"savings_goals": {
                  Row: {
                    "color": string,"commitments": NonNullable<Json>,"completed_at": string | null,"created_at": string,"created_by": string | null,"household_id": string,"icon": string,"id": string,"kind": string,"name": string,"owner_user_id": string | null,"scope": Database["public"]['Enums']["data_scope"],"status": string,"target_amount": number | null,"target_date": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"commitments"?: NonNullable<Json>,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"household_id": string,"icon"?: string,"id"?: string,"kind"?: string,"name": string,"owner_user_id"?: string | null,"scope"?: Database["public"]['Enums']["data_scope"],"status"?: string,"target_amount"?: number | null,"target_date"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "color"?: string,"commitments"?: NonNullable<Json>,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"household_id"?: string,"icon"?: string,"id"?: string,"kind"?: string,"name"?: string,"owner_user_id"?: string | null,"scope"?: Database["public"]['Enums']["data_scope"],"status"?: string,"target_amount"?: number | null,"target_date"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "savings_goals_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"transaction_attachments": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"deleted_by": string | null,"description": string | null,"file_name": string,"household_id": string,"id": string,"mime_type": string,"size_bytes": number,"storage_path": string,"transaction_id": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"file_name": string,"household_id": string,"id"?: string,"mime_type": string,"size_bytes": number,"storage_path": string,"transaction_id": string,"uploaded_by"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"file_name"?: string,"household_id"?: string,"id"?: string,"mime_type"?: string,"size_bytes"?: number,"storage_path"?: string,"transaction_id"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transaction_attachments_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transaction_attachments_transaction_id_fkey"
      columns: ["transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "allow_overpayment": boolean,"amount": number,"bill_cycle_id": string | null,"budget_move_id": string | null,"category_id": string | null,"client_request_id": string | null,"created_at": string,"created_by": string | null,"debt_charge_kind": string | null,"debt_id": string | null,"description": string,"fund_id": string | null,"household_id": string,"id": string,"is_extraordinary": boolean,"member_id": string | null,"notes": string | null,"occurred_on": string,"owner_user_id": string | null,"payment_method_id": string | null,"period_id": string | null,"savings_goal_id": string | null,"scope": Database["public"]['Enums']["data_scope"],"status": string,"to_fund_id": string | null,"type": string,"updated_at": string,"updated_by": string | null,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_overpayment"?: boolean,"amount": number,"bill_cycle_id"?: string | null,"budget_move_id"?: string | null,"category_id"?: string | null,"client_request_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"debt_charge_kind"?: string | null,"debt_id"?: string | null,"description": string,"fund_id"?: string | null,"household_id": string,"id"?: string,"is_extraordinary"?: boolean,"member_id"?: string | null,"notes"?: string | null,"occurred_on"?: string,"owner_user_id"?: string | null,"payment_method_id"?: string | null,"period_id"?: string | null,"savings_goal_id"?: string | null,"scope"?: Database["public"]['Enums']["data_scope"],"status"?: string,"to_fund_id"?: string | null,"type": string,"updated_at"?: string,"updated_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "allow_overpayment"?: boolean,"amount"?: number,"bill_cycle_id"?: string | null,"budget_move_id"?: string | null,"category_id"?: string | null,"client_request_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"debt_charge_kind"?: string | null,"debt_id"?: string | null,"description"?: string,"fund_id"?: string | null,"household_id"?: string,"id"?: string,"is_extraordinary"?: boolean,"member_id"?: string | null,"notes"?: string | null,"occurred_on"?: string,"owner_user_id"?: string | null,"payment_method_id"?: string | null,"period_id"?: string | null,"savings_goal_id"?: string | null,"scope"?: Database["public"]['Enums']["data_scope"],"status"?: string,"to_fund_id"?: string | null,"type"?: string,"updated_at"?: string,"updated_by"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_bill_cycle_id_fkey"
      columns: ["bill_cycle_id"]
isOneToOne: false
      referencedRelation: "bill_cycles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_bill_cycle_id_fkey"
      columns: ["bill_cycle_id"]
isOneToOne: false
      referencedRelation: "v_bill_cycles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_budget_move_fk"
      columns: ["budget_move_id"]
isOneToOne: false
      referencedRelation: "budget_moves"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_debt_id_fkey"
      columns: ["debt_id"]
isOneToOne: false
      referencedRelation: "debts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_debt_id_fkey"
      columns: ["debt_id"]
isOneToOne: false
      referencedRelation: "v_debt_balances"
      referencedColumns: ["debt_id"]
    },{
      foreignKeyName: "transactions_debt_id_fkey"
      columns: ["debt_id"]
isOneToOne: false
      referencedRelation: "v_debts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_fund_id_fkey"
      columns: ["fund_id"]
isOneToOne: false
      referencedRelation: "funds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_fund_id_fkey"
      columns: ["fund_id"]
isOneToOne: false
      referencedRelation: "v_fund_balances"
      referencedColumns: ["fund_id"]
    },{
      foreignKeyName: "transactions_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_payment_method_id_fkey"
      columns: ["payment_method_id"]
isOneToOne: false
      referencedRelation: "payment_methods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_period_id_fkey"
      columns: ["period_id"]
isOneToOne: false
      referencedRelation: "budget_periods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_savings_goal_id_fkey"
      columns: ["savings_goal_id"]
isOneToOne: false
      referencedRelation: "savings_goals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_savings_goal_id_fkey"
      columns: ["savings_goal_id"]
isOneToOne: false
      referencedRelation: "v_goal_balances"
      referencedColumns: ["goal_id"]
    },{
      foreignKeyName: "transactions_to_fund_id_fkey"
      columns: ["to_fund_id"]
isOneToOne: false
      referencedRelation: "funds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_to_fund_id_fkey"
      columns: ["to_fund_id"]
isOneToOne: false
      referencedRelation: "v_fund_balances"
      referencedColumns: ["fund_id"]
    }
                  ]
                }
          }
          Views: {
            "v_allocations": {
                  Row: {
                    "amount": number,"category_color": string,"category_icon": string,"category_id": string,"category_kind": string,"category_name": string,"effective_amount": number | null,"extraordinary_spent": number | null,"household_id": string,"id": string,"is_recurring": boolean,"is_variable": boolean,"linked_fund_id": string | null,"month": number,"moved_in": number | null,"moved_out": number | null,"note": string | null,"period_id": string,"shares": NonNullable<Json>,"spent": number | null,"tx_count": number | null,"year": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "budget_allocations_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "budget_allocations_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "budget_allocations_period_id_fkey"
      columns: ["period_id"]
isOneToOne: false
      referencedRelation: "budget_periods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "categories_linked_fund_id_fkey"
      columns: ["linked_fund_id"]
isOneToOne: false
      referencedRelation: "funds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "categories_linked_fund_id_fkey"
      columns: ["linked_fund_id"]
isOneToOne: false
      referencedRelation: "v_fund_balances"
      referencedColumns: ["fund_id"]
    }
                  ]
                },"v_bill_cycles": {
                  Row: {
                    "amount_type": string,"bill_id": string,"bill_kind": string,"bill_name": string,"cancelled_at": string | null,"category_id": string,"due_date": string,"expected_amount": number,"household_id": string,"id": string,"last_paid_on": string | null,"note": string | null,"original_due_date": string,"owner_user_id": string | null,"paid_amount": number | null,"provider": string | null,"responsible_member_id": string | null,"scope": Database["public"]['Enums']["data_scope"],"shares": NonNullable<Json>,"status": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "bill_cycles_bill_id_fkey"
      columns: ["bill_id"]
isOneToOne: false
      referencedRelation: "bills"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bill_cycles_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bills_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bills_responsible_member_id_fkey"
      columns: ["responsible_member_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id"]
    }
                  ]
                },"v_debt_balances": {
                  Row: {
                    "balance": number | null,"debt_id": string,"fees_charged": number | null,"household_id": string,"interest_charged": number | null,"last_payment_on": string | null,"owner_user_id": string | null,"paid": number | null,"scope": Database["public"]['Enums']["data_scope"]
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "debts_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"v_debts": {
                  Row: {
                    "balance": number | null,"created_at": string,"created_by": string | null,"creditor": string | null,"due_date": string | null,"fees_charged": number | null,"frequency": string,"household_id": string,"id": string,"installment_amount": number | null,"installments_count": number | null,"interest_charged": number | null,"interest_rate": number | null,"kind": string,"last_payment_on": string | null,"name": string,"next_due_date": string | null,"notes": string | null,"original_amount": number,"owner_user_id": string | null,"paid": number | null,"paid_installments": number | null,"responsible_member_id": string | null,"scope": Database["public"]['Enums']["data_scope"],"start_date": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "debts_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "debts_responsible_member_id_fkey"
      columns: ["responsible_member_id"]
isOneToOne: false
      referencedRelation: "household_members"
      referencedColumns: ["id"]
    }
                  ]
                },"v_fund_balances": {
                  Row: {
                    "balance": number | null,"fund_id": string,"household_id": string,"inflow": number | null,"initial_balance": number,"outflow": number | null,"owner_user_id": string | null,"scope": Database["public"]['Enums']["data_scope"]
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "funds_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"v_goal_balances": {
                  Row: {
                    "balance": number | null,"deposits": number | null,"goal_id": string,"household_id": string,"last_deposit_on": string | null,"owner_user_id": string | null,"scope": Database["public"]['Enums']["data_scope"],"withdrawals": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "savings_goals_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "_ensure_bill_cycles":
{ Args: { "horizon"?: number,"p_bill": string }; Returns: number
                           },
"_ensure_period":
{ Args: { "hid": string,"p_month": number,"p_year": number }; Returns: string
                           },
"_next_cycle_date":
{ Args: { "p_bill": Omit<Database["public"]['Tables']["bills"]['Row'], Database["public"]['Tables']["bills"]['ComputedFields']>,"p_last": string }; Returns: string
                           },
"accept_invite":
{ Args: { "p_code": string,"p_display_name"?: string }; Returns: string
                           },
"adjust_allocation":
{ Args: { "p_allocation": string,"p_amount": number,"p_reason": string }; Returns: undefined
                           },
"allocation_available":
{ Args: { "p_allocation": string }; Returns: number
                           },
"assert_member_of":
{ Args: { "hid": string,"p_member": string }; Returns: undefined
                           },
"assert_ref":
{ Args: { "p_hid": string,"p_id": string,"p_kind": string,"p_owner": string,"p_scope": Database["public"]['Enums']["data_scope"] }; Returns: undefined
                           },
"bill_due_on":
{ Args: { "p_day": number,"p_month": number,"p_year": number }; Returns: string
                           },
"can_access_receipt_path":
{ Args: { "p_name": string,"p_require_posted"?: boolean }; Returns: boolean
                           },
"can_see":
{ Args: { "hid": string,"owner": string,"s": Database["public"]['Enums']["data_scope"] }; Returns: boolean
                           },
"can_write":
{ Args: { "hid": string,"owner": string,"s": Database["public"]['Enums']["data_scope"] }; Returns: boolean
                           },
"copy_previous_budget":
{ Args: { "p_period": string }; Returns: number
                           },
"create_household":
{ Args: { "p_setup": Json }; Returns: string
                           },
"create_invite":
{ Args: { "p_member"?: string }; Returns: string
                           },
"create_next_bill_cycle":
{ Args: { "p_bill": string }; Returns: string
                           },
"debt_balance":
{ Args: { "did": string }; Returns: number
                           },
"delete_attachment":
{ Args: { "p_id": string,"p_reason": string }; Returns: string
                           },
"ensure_bill_cycles":
{ Args: { "hid": string }; Returns: number
                           },
"ensure_period":
{ Args: { "hid": string,"p_month": number,"p_year": number }; Returns: string
                           },
"fmt_money":
{ Args: { "v": number }; Returns: string
                           },
"freq_interval":
{ Args: { "f": string }; Returns: string
                           },
"fund_balance":
{ Args: { "fid": string }; Returns: number
                           },
"gen_invite_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"generate_notifications":
{ Args: { "p_today"?: string }; Returns: number
                           },
"goal_balance":
{ Args: { "gid": string }; Returns: number
                           },
"is_admin":
{ Args: { "hid": string }; Returns: boolean
                           },
"is_member":
{ Args: { "hid": string }; Returns: boolean
                           },
"move_budget":
{ Args: { "p_amount": number,"p_from_allocation"?: string,"p_fund"?: string,"p_goal"?: string,"p_kind": string,"p_reason": string,"p_to_allocation"?: string }; Returns: string
                           },
"my_household_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_member_id":
{ Args: { "hid": string }; Returns: string
                           },
"notify_users":
{ Args: { "hid": string,"owner": string,"p_body": string,"p_data": Json,"p_dedupe": string,"p_kind": string,"p_title": string,"s": Database["public"]['Enums']["data_scope"] }; Returns: undefined
                           },
"register_push_token":
{ Args: { "p_platform": string,"p_token": string }; Returns: undefined
                           },
"today_local":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"unregister_push_token":
{ Args: { "p_token": string }; Returns: undefined
                           },
"valid_commitments":
{ Args: { "c": Json,"hid": string }; Returns: boolean
                           },
"valid_shares":
{ Args: { "hid": string,"shares": Json }; Returns: boolean
                           },
"void_budget_move":
{ Args: { "p_move": string,"p_reason": string }; Returns: undefined
                           },
"void_transaction":
{ Args: { "p_id": string,"p_reason": string }; Returns: undefined
                           }
          }
          Enums: {
            "data_scope": "household"|"personal","member_role": "admin"|"member"
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
            "data_scope": ["household", "personal"],"member_role": ["admin", "member"]
          }
        }
} as const
